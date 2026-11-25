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
export { parseServiceMcp, toolInputSchema, type McpToolRegistration } from './service/mcp.js';
export { settingsValidator, type Settings, type SettingsValidator } from './service/settings.js';
export { listenLocal, LOCAL_HOST } from './service/listen-local.js';
export {
  createGitHubClient,
  type CreateGitHubClientOptions,
  type GitHubApi,
} from './github/client.js';
export {
  classifyGitHubError,
  translateGitHubError,
  type GitHubErrorKind,
} from './github/errors.js';
export { checkRepoAccess, getAuthStatus } from './github/check.js';
export {
  createJiraProvider,
  type CreateJiraProviderOptions,
  type JiraFetch,
} from './jira/client.js';
export { translateJiraStatus } from './jira/errors.js';
export { checkJiraProject } from './jira/check.js';
export type { JiraProject, JiraProvider } from './jira/types.js';
