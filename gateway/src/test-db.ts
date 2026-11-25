import { resolve } from 'node:path';
import { openDatabase, runMigrations, type Db } from '@atalaya/core';

/** Base en memoria con las migraciones reales del gateway (solo para tests). */
export function createTestDb(): Db {
  const db = openDatabase({ path: ':memory:' });
  runMigrations({
    db,
    service: 'gateway',
    prefix: 'gateway_',
    dir: resolve(import.meta.dirname, '..', 'db', 'migrations'),
  });
  return db;
}
