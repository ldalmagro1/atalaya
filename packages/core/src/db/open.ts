import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

export interface OpenDatabaseOptions {
  path: string;
}

const BUSY_TIMEOUT_MS = 5000;
const RETRY_MS = 20;

/**
 * Activa WAL reintentando: si varios procesos lo hacen a la vez sobre una base nueva, SQLite
 * responde `SQLITE_BUSY` sin esperar el `busy_timeout`.
 */
function enableWal(db: Db): void {
  const deadline = Date.now() + BUSY_TIMEOUT_MS;
  for (;;) {
    try {
      db.pragma('journal_mode = WAL');
      return;
    } catch (error) {
      const busy = (error as { code?: unknown }).code === 'SQLITE_BUSY';
      if (!busy || Date.now() >= deadline) throw error;
      // Espera bloqueante: la apertura es síncrona y ocurre al arrancar.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_MS);
    }
  }
}

/**
 * Abre la base única (ADR-003): crea la carpeta si falta y activa WAL,
 * claves foráneas y espera por bloqueos.
 */
export function openDatabase({ path }: OpenDatabaseOptions): Db {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  enableWal(db);
  db.pragma('foreign_keys = ON');
  return db;
}
