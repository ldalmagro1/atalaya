import { resolve } from 'node:path';
import { createServiceApp, listenLocal, openDatabase, runMigrations } from '@atalaya/core';
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

const app = createServiceApp({
  id: 'pr-reviewer',
  name: 'Revisor de pull requests',
  description: 'Lee pull requests de GitHub y ayuda a revisarlos con Claude.',
  version: '0.0.0',
  internalToken: config.internalToken,
});

app.addHook('onClose', async () => {
  db.close();
});

await listenLocal(app, config.port);
