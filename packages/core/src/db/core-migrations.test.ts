import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCoreMigrations } from './core-migrations.js';
import { openDatabase, type Db } from './open.js';

const WORKER = resolve(import.meta.dirname, 'core-migrations.worker.ts');
const MIGRATIONS = [{ name: '001_gh_cache.sql' }];

const temps: string[] = [];
const dbs: Db[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atalaya-core-'));
  temps.push(dir);
  return join(dir, 'atalaya.db');
}
function open(path: string): Db {
  const db = openDatabase({ path });
  dbs.push(db);
  return db;
}
const registered = (db: Db) =>
  db.prepare("SELECT name FROM core_migrations WHERE service = 'core'").all();

/** Arranca un proceso real que migra la base cuando recibe `go()`. */
function startWorker(path: string) {
  const child = spawn(process.execPath, ['--import', 'tsx', WORKER, path], {
    cwd: import.meta.dirname,
  });
  let stdout = '';
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += String(chunk)));
  const ready = new Promise<void>((done, fail) => {
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      if (stdout.includes('ready')) done();
    });
    child.on('exit', () => fail(new Error(`El proceso terminó antes de tiempo: ${stderr}`)));
  });
  const finished = new Promise<string[]>((done, fail) => {
    child.on('close', (code) => {
      const applied = /applied (.*)/.exec(stdout)?.[1];
      if (code !== 0 || !applied) fail(new Error(`Falló la migración (${code}): ${stderr}`));
      else done(JSON.parse(applied) as string[]);
    });
  });
  return { ready, finished, go: () => child.stdin.end('go\n') };
}

describe('runCoreMigrations', () => {
  it('crea core_gh_cache una sola vez y es idempotente', () => {
    const db = open(':memory:');
    expect(runCoreMigrations(db)).toEqual(['001_gh_cache.sql']);
    expect(runCoreMigrations(db)).toEqual([]);
    expect(registered(db)).toEqual(MIGRATIONS);
    const columns = db.prepare('SELECT name FROM pragma_table_info(?)').all('core_gh_cache');
    expect(columns).toEqual(
      ['key', 'etag', 'payload_json', 'fetched_at'].map((name) => ({ name })),
    );
  });

  it('no falla si otro proceso migra entre la lectura y la aplicación', () => {
    const path = tempDbPath();
    const first = open(path);
    const second = open(path);
    const prepare = first.prepare.bind(first);
    let interleaved = false;
    // Justo después de que `first` lea las migraciones aplicadas, `second` las aplica.
    first.prepare = ((sql: string) => {
      const statement = prepare(sql);
      if (!interleaved && sql.startsWith('SELECT name FROM core_migrations')) {
        const all = statement.all.bind(statement);
        statement.all = (...params: unknown[]) => {
          const rows = all(...params);
          interleaved = true;
          expect(runCoreMigrations(second)).toEqual(['001_gh_cache.sql']);
          return rows;
        };
      }
      return statement;
    }) as Db['prepare'];

    expect(runCoreMigrations(first)).toEqual([]);
    expect(interleaved).toBe(true);
    expect(registered(second)).toEqual(MIGRATIONS);
  });

  it('dos procesos sobre la misma base no fallan ni duplican la migración', async () => {
    for (let round = 0; round < 3; round += 1) {
      const path = tempDbPath();
      const workers = [startWorker(path), startWorker(path)];
      await Promise.all(workers.map((worker) => worker.ready));
      for (const worker of workers) worker.go();
      const applied = await Promise.all(workers.map((worker) => worker.finished));

      expect(applied.flat()).toEqual(['001_gh_cache.sql']);
      expect(registered(open(path))).toEqual(MIGRATIONS);
    }
  }, 60_000);
});
