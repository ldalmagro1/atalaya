export const CORE_PACKAGE = '@atalaya/core';

export { AppError, registerErrorHandling, type ErrorBody } from './lib/errors.js';
export { openDatabase, type Db, type OpenDatabaseOptions } from './db/open.js';
export { runMigrations, type RunMigrationsOptions } from './db/migrate.js';
export { MigrationError } from './db/validate-migration.js';
export {
  createServiceApp,
  INTERNAL_TOKEN_HEADER,
  requireInternalToken,
  type CreateServiceAppOptions,
  type ServiceManifest,
} from './service/create-service-app.js';
export { listenLocal, LOCAL_HOST } from './service/listen-local.js';
