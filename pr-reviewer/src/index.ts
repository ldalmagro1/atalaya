import { resolve } from 'node:path';
import { listenLocal, openDatabase, runMigrations } from '@atalaya/core';
import { buildApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';

loadEnvFile();
const config = loadConfig();

const db = openDatabase({ path: config.dbPath });
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
