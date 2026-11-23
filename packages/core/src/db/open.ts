import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

export interface OpenDatabaseOptions {
  path: string;
}

/**
 * Abre la base única (ADR-003): crea la carpeta si falta y activa WAL,
 * claves foráneas y espera por bloqueos.
 */
export function openDatabase({ path }: OpenDatabaseOptions): Db {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}
