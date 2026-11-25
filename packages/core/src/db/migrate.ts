import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './open.js';
import { MigrationError, validateMigration } from './validate-migration.js';

export interface RunMigrationsOptions {
  db: Db;
  /** Id del servicio dueño de las migraciones (`gateway`, `prreviewer`…). */
  service: string;
  /** Prefijo de sus tablas, con el guion bajo final (`gateway_`, `prreviewer_`). */
  prefix: string;
  /** Carpeta con los `NNN_nombre.sql` del servicio. */
  dir: string;
}

const FILE_PATTERN = /^\d{3,}_[a-z0-9_-]+\.sql$/i;
const PREFIX_PATTERN = /^[a-z][a-z0-9]*_$/;

/**
 * Aplica en orden las migraciones pendientes de un servicio. Cada una corre una sola vez y
 * dentro de una transacción; se registran en `core_migrations (service, name)`.
 * Devuelve los nombres aplicados en esta corrida.
 */
export function runMigrations({ db, service, prefix, dir }: RunMigrationsOptions): string[] {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new MigrationError(`Prefijo inválido "${prefix}": usa minúsculas y un "_" final`);
  }
  if (prefix === 'core_' && service !== 'core') {
    throw new MigrationError('El prefijo "core_" es solo de la librería');
  }

  db.exec(
    `CREATE TABLE IF NOT EXISTS core_migrations (
       service TEXT NOT NULL,
       name TEXT NOT NULL,
       PRIMARY KEY (service, name)
     )`,
  );

  const sqlFiles = readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.sql'));
  const invalid = sqlFiles.find((file) => !FILE_PATTERN.test(file));
  if (invalid) {
    throw new MigrationError(`Nombre de migración inválido: ${invalid} (se espera NNN_nombre.sql)`);
  }

  const applied = new Set(
    db
      .prepare('SELECT name FROM core_migrations WHERE service = ?')
      .all(service)
      .map((row) => (row as { name: string }).name),
  );
  const pending = sqlFiles
    .filter((file) => !applied.has(file))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));

  // Se valida todo antes de aplicar nada: una migración inválida no deja la base a medias.
  for (const { name, sql } of pending) validateMigration(sql, prefix, `${service}/${name}`);

  const insert = db.prepare('INSERT INTO core_migrations (service, name) VALUES (?, ?)');
  const isApplied = db.prepare('SELECT 1 FROM core_migrations WHERE service = ? AND name = ?');
  const ran: string[] = [];
  for (const { name, sql } of pending) {
    // `immediate` toma el bloqueo de escritura antes de releer: si otro proceso aplicó la
    // migración desde la lectura de arriba, se salta en vez de ejecutarla dos veces.
    const apply = db.transaction(() => {
      if (isApplied.get(service, name)) return;
      db.exec(sql);
      insert.run(service, name);
      ran.push(name);
    });
    apply.immediate();
  }
  return ran;
}
