import { resolve } from 'node:path';
import { listenLocal, openDatabase, runMigrations } from '@atalaya/core';
import { buildApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';
import { registeredTools } from './tools.config.js';

loadEnvFile();

let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Configuración inválida del gateway');
  process.exit(1);
}

const db = openDatabase({ path: config.dbPath });
runMigrations({
  db,
  service: 'gateway',
  prefix: 'gateway_',
  dir: resolve(import.meta.dirname, '..', 'db', 'migrations'),
});

const app = await buildApp({
  db,
  internalToken: config.internalToken,
  tools: registeredTools(config),
  githubToken: config.githubToken,
});
app.addHook('onClose', async () => {
  db.close();
});

await listenLocal(app, config.port);
