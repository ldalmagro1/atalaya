import { resolve } from 'node:path';
import { listenLocal, openDatabase, runCoreMigrations, runMigrations } from '@atalaya/core';
import { buildApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';

loadEnvFile();
const config = loadConfig();

const db = openDatabase({ path: config.dbPath });
runCoreMigrations(db);
runMigrations({
  db,
  service: 'prreviewer',
  prefix: 'prreviewer_',
  dir: resolve(import.meta.dirname, '..', 'db', 'migrations'),
});

const app = buildApp({ internalToken: config.internalToken });

app.addHook('onClose', async () => {
  db.close();
});

await listenLocal(app, config.port);
