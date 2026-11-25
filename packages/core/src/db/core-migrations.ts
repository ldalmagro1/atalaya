import { resolve } from 'node:path';
import { runMigrations } from './migrate.js';
import type { Db } from './open.js';

const CORE_MIGRATIONS_DIR = resolve(import.meta.dirname, '..', '..', 'db', 'migrations');

/**
 * Aplica las migraciones de la librería (tablas `core_`). Cada proceso que usa la base la llama
 * al arrancar: es idempotente y soporta que varios arranquen a la vez.
 */
export function runCoreMigrations(db: Db): string[] {
  return runMigrations({ db, service: 'core', prefix: 'core_', dir: CORE_MIGRATIONS_DIR });
}
