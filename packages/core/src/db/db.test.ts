import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';
import { openDatabase, type Db } from './open.js';

let root: string;
let db: Db;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'atalaya-core-'));
  db = openDatabase({ path: join(root, 'sub', 'nueva', 'test.db') });
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

function migrationsDir(name: string, files: Record<string, string>): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, sql] of Object.entries(files)) writeFileSync(join(dir, file), sql);
  return dir;
}

const tableExists = (name: string): boolean =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !==
  undefined;

describe('openDatabase', () => {
  it('crea la carpeta y deja WAL, foreign_keys y busy_timeout', () => {
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
  });
});

describe('runMigrations', () => {
  it('aplica en orden y una sola vez', () => {
    const dir = migrationsDir('a', {
      '002_indice.sql': 'CREATE INDEX prreviewer_runs_name ON prreviewer_runs (name);',
      '001_tabla.sql': 'CREATE TABLE prreviewer_runs (id INTEGER PRIMARY KEY, name TEXT);',
    });
    const options = { db, service: 'prreviewer', prefix: 'prreviewer_', dir };

    expect(runMigrations(options)).toEqual(['001_tabla.sql', '002_indice.sql']);
    expect(runMigrations(options)).toEqual([]);
    expect(tableExists('prreviewer_runs')).toBe(true);
  });

  it('dos servicios con el mismo nombre de archivo no se pisan', () => {
    const a = migrationsDir('a', { '001_init.sql': 'CREATE TABLE gateway_t (id INTEGER);' });
    const b = migrationsDir('b', { '001_init.sql': 'CREATE TABLE prreviewer_t (id INTEGER);' });

    runMigrations({ db, service: 'gateway', prefix: 'gateway_', dir: a });
    runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer_', dir: b });

    expect(tableExists('gateway_t')).toBe(true);
    expect(tableExists('prreviewer_t')).toBe(true);
    expect(db.prepare('SELECT service, name FROM core_migrations ORDER BY service').all()).toEqual([
      { service: 'gateway', name: '001_init.sql' },
      { service: 'prreviewer', name: '001_init.sql' },
    ]);
  });

  it('acepta una carpeta vacía', () => {
    const dir = migrationsDir('vacia', {});
    expect(runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer_', dir })).toEqual([]);
  });

  it('acepta claves foráneas dentro del mismo prefijo', () => {
    const dir = migrationsDir('fk-ok', {
      '001_init.sql': `
        CREATE TABLE prreviewer_a (id INTEGER PRIMARY KEY);
        CREATE TABLE prreviewer_b (id INTEGER, a_id INTEGER REFERENCES prreviewer_a(id));
        CREATE TRIGGER prreviewer_trg AFTER INSERT ON prreviewer_b BEGIN
          UPDATE prreviewer_a SET id = id; END;`,
    });
    expect(() =>
      runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer_', dir }),
    ).not.toThrow();
  });

  const rejected: Record<string, string> = {
    'tabla fuera del prefijo': 'CREATE TABLE otra_tabla (id INTEGER);',
    'índice fuera del prefijo': 'CREATE INDEX otro_idx ON prreviewer_a (id);',
    'trigger fuera del prefijo': `CREATE TRIGGER otro_trg AFTER INSERT ON prreviewer_a BEGIN SELECT 1; END;`,
    'trigger que escribe en tabla ajena': `CREATE TRIGGER prreviewer_trg AFTER INSERT ON prreviewer_a BEGIN UPDATE gateway_x SET id = 1; END;`,
    'vista fuera del prefijo': 'CREATE VIEW otra_vista AS SELECT 1;',
    'clave foránea en línea hacia otro prefijo':
      'CREATE TABLE prreviewer_a (id INTEGER, g INTEGER REFERENCES gateway_x(id));',
    'clave foránea de tabla hacia otro prefijo':
      'CREATE TABLE prreviewer_a (id INTEGER, g INTEGER, FOREIGN KEY (g) REFERENCES gateway_x(id));',
    'clave foránea agregada con ALTER':
      'ALTER TABLE prreviewer_a ADD COLUMN g INTEGER REFERENCES gateway_x(id);',
    'renombrar hacia otro prefijo': 'ALTER TABLE prreviewer_a RENAME TO gateway_a;',
    'borrar tabla ajena': 'DROP TABLE gateway_x;',
    'escribir en tabla ajena': 'INSERT INTO core_migrations (service, name) VALUES (1, 2);',
    'esquema calificado': 'CREATE TABLE main.prreviewer_a (id INTEGER);',
    'PRAGMA (no soportado)': 'PRAGMA foreign_keys = OFF;',
    'SQL inválido': 'esto no es sql',
  };

  it.each(Object.entries(rejected))('rechaza: %s', (_name, sql) => {
    const dir = migrationsDir('rechazo', { '001_mala.sql': sql });
    expect(() => runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer_', dir })).toThrow(
      /prreviewer\/001_mala\.sql/,
    );
    expect(db.prepare('SELECT COUNT(*) AS n FROM core_migrations').get()).toEqual({ n: 0 });
  });

  it('no aplica nada si una migración posterior es inválida', () => {
    const dir = migrationsDir('mixta', {
      '001_ok.sql': 'CREATE TABLE prreviewer_ok (id INTEGER);',
      '002_mala.sql': 'CREATE TABLE ajena (id INTEGER);',
    });
    expect(() =>
      runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer_', dir }),
    ).toThrow();
    expect(tableExists('prreviewer_ok')).toBe(false);
  });

  it('revierte la transacción si la migración falla al ejecutarse', () => {
    const dir = migrationsDir('falla', {
      '001_falla.sql':
        'CREATE TABLE prreviewer_x (id INTEGER); INSERT INTO prreviewer_nada (id) VALUES (1);',
    });
    expect(() =>
      runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer_', dir }),
    ).toThrow();
    expect(tableExists('prreviewer_x')).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM core_migrations').get()).toEqual({ n: 0 });
  });

  it('rechaza nombres de archivo inválidos y prefijos mal formados', () => {
    const dir = migrationsDir('nombres', { 'init.sql': 'CREATE TABLE prreviewer_a (id INTEGER);' });
    expect(() => runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer_', dir })).toThrow(
      /Nombre de migración inválido/,
    );
    expect(() => runMigrations({ db, service: 'prreviewer', prefix: 'prreviewer', dir })).toThrow(
      /Prefijo inválido/,
    );
    expect(() => runMigrations({ db, service: 'prreviewer', prefix: 'core_', dir })).toThrow(
      /solo de la librería/,
    );
  });
});
