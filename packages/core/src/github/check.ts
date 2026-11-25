import type { GitHubStatus, RepoCheckResult } from '@atalaya/contracts';
import type { GitHubApi } from './client.js';
import { classifyGitHubError, translateGitHubError } from './errors.js';

/** `users.getAuthenticated`: un 401 es `valid: false`; los demás errores se lanzan traducidos. */
export async function getAuthStatus(
  api: GitHubApi,
): Promise<Pick<GitHubStatus, 'valid' | 'login'>> {
  try {
    const { data } = await api.users.getAuthenticated();
    return { valid: true, login: data.login };
  } catch (error) {
    if (classifyGitHubError(error) === 'auth') return { valid: false, login: null };
    throw translateGitHubError(error);
  }
}

/** Prueba un permiso: `true`, `false` (403/404) o error lanzado (401, límite de uso, 5xx). */
async function canDo(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    if (classifyGitHubError(error) === 'not_found') return false;
    throw translateGitHubError(error);
  }
}

/**
 * Prueba el acceso del token a un repo: existencia (`repos.get`), lectura de PRs y lectura de
 * contenido. Si el repo no se encuentra o hay un error general, lanza `AppError`; si falta solo
 * un permiso, lo reporta en el resultado. El permiso de escritura no se puede comprobar sin
 * escribir, así que `canWritePulls` queda siempre `unverified`.
 */
export async function checkRepoAccess(
  api: GitHubApi,
  owner: string,
  repo: string,
): Promise<RepoCheckResult> {
  let defaultBranch: string;
  try {
    defaultBranch = (await api.repos.get({ owner, repo })).data.default_branch;
  } catch (error) {
    throw translateGitHubError(error);
  }
  const canReadPulls = await canDo(() => api.pulls.list({ owner, repo, per_page: 1 }));
  const canReadContents = await canDo(() => api.repos.getContent({ owner, repo, path: '' }));
  const ok = canReadPulls && canReadContents;
  const missing = [
    ...(canReadPulls ? [] : ['leer pull requests (Pull requests: Read)']),
    ...(canReadContents ? [] : ['leer el contenido (Contents: Read-only)']),
  ];
  return {
    ok,
    repoFound: true,
    canReadPulls,
    canReadContents,
    canWritePulls: 'unverified',
    defaultBranch,
    message: ok
      ? `El token accede a ${owner}/${repo} y puede leer pull requests y contenido. El permiso de escritura en pull requests no se puede comprobar sin escribir.`
      : `El token ve ${owner}/${repo}, pero no puede ${missing.join(' ni ')}. Revise los permisos del token.`,
  };
}
