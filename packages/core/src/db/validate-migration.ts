import sqlParser from 'node-sql-parser';

const parser = new sqlParser.Parser();

/** Sentencias permitidas en una migración; el resto se rechaza. */
const ALLOWED_STATEMENTS = new Set([
  'create',
  'alter',
  'drop',
  'insert',
  'update',
  'delete',
  'replace',
]);

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Valida que una migración solo toque objetos del servicio (ADR-003): tablas, índices,
 * triggers y vistas con su prefijo, y claves foráneas solo hacia tablas del mismo prefijo.
 * Falla cerrado: lo que el parser no entiende (PRAGMA, tablas virtuales, DROP INDEX…) se rechaza.
 */
export function validateMigration(sql: string, prefix: string, label: string): void {
  let ast: unknown;
  try {
    ast = parser.astify(sql, { database: 'sqlite' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new MigrationError(`${label}: SQL no soportado o inválido (${detail})`);
  }

  const statements: unknown[] = Array.isArray(ast) ? ast : [ast];
  if (statements.length === 0) throw new MigrationError(`${label}: la migración está vacía`);

  for (const statement of statements) {
    const type = isRecord(statement) ? statement.type : undefined;
    if (typeof type !== 'string' || !ALLOWED_STATEMENTS.has(type)) {
      throw new MigrationError(`${label}: sentencia no permitida (${String(type)})`);
    }
  }

  const check = (kind: string, name: unknown): void => {
    if (typeof name !== 'string' || !name.toLowerCase().startsWith(prefix.toLowerCase())) {
      throw new MigrationError(
        `${label}: ${kind} "${String(name)}" no empieza con el prefijo "${prefix}" del servicio`,
      );
    }
  };

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;

    // Referencia a tabla (FROM, CREATE/ALTER/DROP TABLE, trigger, REFERENCES…).
    if ('db' in node && typeof node.table === 'string') {
      if (node.db !== null && node.db !== undefined) {
        throw new MigrationError(`${label}: no se permiten nombres calificados con esquema`);
      }
      check('tabla', node.table);
    }
    // CREATE INDEX: { schema, name }.
    if ('schema' in node && typeof node.name === 'string') check('índice', node.name);
    // CREATE VIEW: { db, view }.
    if ('db' in node && typeof node.view === 'string') check('vista', node.view);
    // ALTER TABLE … RENAME TO nueva.
    if (node.action === 'rename' && typeof node.table === 'string') check('tabla', node.table);

    Object.values(node).forEach(walk);
  };

  walk(statements);
}
