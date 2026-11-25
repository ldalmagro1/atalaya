import { resolve } from 'node:path';
import { openDatabase, runCoreMigrations, runMigrations, type Db } from '@atalaya/core';

/** Base en memoria con las migraciones reales de core y del gateway (solo para tests). */
export function createTestDb(): Db {
  const db = openDatabase({ path: ':memory:' });
  runCoreMigrations(db);
  runMigrations({
    db,
    service: 'gateway',
    prefix: 'gateway_',
    dir: resolve(import.meta.dirname, '..', 'db', 'migrations'),
  });
  return db;
}
