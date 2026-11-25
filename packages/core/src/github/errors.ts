import { AppError } from '../lib/errors.js';

export type GitHubErrorKind = 'auth' | 'not_found' | 'rate_limit' | 'unavailable';

interface ErrorLike {
  status?: unknown;
  response?: { headers?: Record<string, unknown> };
  message?: unknown;
}

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
}

function header(error: ErrorLike, name: string): string | null {
  const value = error.response?.headers?.[name];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** Clasifica un error de Octokit por su estado HTTP y sus cabeceras. */
export function classifyGitHubError(error: unknown): GitHubErrorKind {
  const e = asErrorLike(error);
  const status = typeof e.status === 'number' ? e.status : null;
  if (status === 401) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 403) {
    const limited = header(e, 'x-ratelimit-remaining') === '0' || header(e, 'retry-after') !== null;
    const secondary = typeof e.message === 'string' && /rate limit/i.test(e.message);
    return limited || secondary ? 'rate_limit' : 'not_found';
  }
  if (status === 404) return 'not_found';
  return 'unavailable';
}

/** Hora de reinicio del límite de uso, en ISO, si GitHub la informó. */
function resetTime(error: ErrorLike): string | null {
  const reset = header(error, 'x-ratelimit-reset');
  if (reset !== null && /^\d+$/.test(reset)) return new Date(Number(reset) * 1000).toISOString();
  const retry = header(error, 'retry-after');
  if (retry !== null && /^\d+$/.test(retry)) {
    return new Date(Date.now() + Number(retry) * 1000).toISOString();
  }
  return null;
}

/**
 * Traduce un error de Octokit a `AppError`. Los mensajes son fijos: nunca se copia el mensaje
 * ni las cabeceras del error original, para que el token no pueda filtrarse.
 */
export function translateGitHubError(error: unknown): AppError {
  const kind = classifyGitHubError(error);
  switch (kind) {
    case 'auth':
      return new AppError(
        'GITHUB_AUTH',
        'GitHub rechazó el token: es inválido, venció o fue revocado. Revise GITHUB_TOKEN en .env.',
        502,
      );
    case 'not_found':
      return new AppError(
        'REPO_NOT_FOUND_OR_NO_ACCESS',
        'El repositorio no existe en GitHub o el token no tiene acceso a él. Revise el nombre y que el token incluya este repositorio.',
        404,
      );
    case 'rate_limit': {
      const reset = resetTime(asErrorLike(error));
      return new AppError(
        'GITHUB_RATE_LIMIT',
        reset
          ? `GitHub alcanzó el límite de uso. Se reinicia a las ${reset}.`
          : 'GitHub alcanzó el límite de uso. Reintente más tarde.',
        429,
      );
    }
    case 'unavailable':
      return new AppError(
        'GITHUB_UNAVAILABLE',
        'No se pudo conectar con GitHub o respondió con un error. Reintente más tarde.',
        502,
      );
  }
}
