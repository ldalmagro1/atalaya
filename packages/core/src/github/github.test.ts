import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/errors.js';
import { checkRepoAccess, getAuthStatus } from './check.js';
import { createGitHubClient } from './client.js';
import { classifyGitHubError, translateGitHubError } from './errors.js';
import { fakeApi } from './fake-api.js';

const SECRET = 'github_pat_SECRETO_DE_PRUEBA_123456';

/** Error con la forma de `RequestError` de Octokit, con el token en su mensaje. */
const httpError = (status: number, headers: Record<string, string> = {}, message = SECRET) =>
  Object.assign(new Error(message), { status, response: { headers } });

describe('createGitHubClient', () => {
  it('usa el Octokit inyectado sin crear ninguno real', () => {
    const fake = fakeApi();
    expect(createGitHubClient({ token: SECRET, octokit: fake })).toBe(fake);
  });

  it('crea un cliente real con un token', () => {
    expect(createGitHubClient({ token: SECRET }).users).toBeDefined();
  });

  it('rechaza un token vacío sin nombrarlo', () => {
    expect(() => createGitHubClient({ token: '' })).toThrow('vacío');
  });
});

describe('translateGitHubError', () => {
  const cases: [string, unknown, string, number][] = [
    ['401', httpError(401), 'GITHUB_AUTH', 502],
    ['404', httpError(404), 'REPO_NOT_FOUND_OR_NO_ACCESS', 404],
    ['403 sin límite de uso', httpError(403), 'REPO_NOT_FOUND_OR_NO_ACCESS', 404],
    [
      '403 con límite agotado',
      httpError(403, { 'x-ratelimit-remaining': '0' }),
      'GITHUB_RATE_LIMIT',
      429,
    ],
    ['429', httpError(429), 'GITHUB_RATE_LIMIT', 429],
    ['500', httpError(500), 'GITHUB_UNAVAILABLE', 502],
    ['503', httpError(503), 'GITHUB_UNAVAILABLE', 502],
    ['error de red (sin status)', new Error(SECRET), 'GITHUB_UNAVAILABLE', 502],
  ];

  it.each(cases)('%s', (_name, error, code, status) => {
    const translated = translateGitHubError(error);
    expect(translated).toBeInstanceOf(AppError);
    expect(translated).toMatchObject({ code, status });
    expect(translated.message.length).toBeGreaterThan(10);
  });

  it('403 por límite secundario (mensaje) también es límite de uso', () => {
    const error = httpError(403, {}, 'You have exceeded a secondary rate limit');
    expect(classifyGitHubError(error)).toBe('rate_limit');
  });

  it('el límite de uso informa la hora de reinicio', () => {
    const reset = 1_800_000_000;
    const translated = translateGitHubError(
      httpError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
    );
    expect(translated.message).toContain(new Date(reset * 1000).toISOString());
  });

  it('el token nunca aparece en el mensaje traducido', () => {
    for (const [, error] of cases) {
      expect(translateGitHubError(error).message).not.toContain(SECRET);
    }
  });
});

describe('getAuthStatus', () => {
  it('token válido: devuelve el login', async () => {
    await expect(getAuthStatus(fakeApi())).resolves.toEqual({ valid: true, login: 'lucas' });
  });

  it('401: valid false', async () => {
    const api = fakeApi({ users: { getAuthenticated: vi.fn().mockRejectedValue(httpError(401)) } });
    await expect(getAuthStatus(api)).resolves.toEqual({ valid: false, login: null });
  });

  it('5xx: lanza GITHUB_UNAVAILABLE', async () => {
    const api = fakeApi({ users: { getAuthenticated: vi.fn().mockRejectedValue(httpError(502)) } });
    await expect(getAuthStatus(api)).rejects.toMatchObject({ code: 'GITHUB_UNAVAILABLE' });
  });
});

describe('checkRepoAccess', () => {
  it('todo en orden: ok, rama por defecto y escritura sin verificar', async () => {
    const api = fakeApi({
      repos: { get: vi.fn().mockResolvedValue({ data: { default_branch: 'trunk' } }) },
    });
    const result = await checkRepoAccess(api, 'acme', 'api');
    expect(result).toMatchObject({
      ok: true,
      repoFound: true,
      canReadPulls: true,
      canReadContents: true,
      canWritePulls: 'unverified',
      defaultBranch: 'trunk',
    });
    expect(api.pulls.list).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', per_page: 1 });
    expect(api.repos.getContent).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', path: '' });
  });

  it('repo inexistente o sin acceso: lanza REPO_NOT_FOUND_OR_NO_ACCESS', async () => {
    const api = fakeApi({ repos: { get: vi.fn().mockRejectedValue(httpError(404)) } });
    await expect(checkRepoAccess(api, 'acme', 'api')).rejects.toMatchObject({
      code: 'REPO_NOT_FOUND_OR_NO_ACCESS',
    });
  });

  it('falta el permiso de PRs: lo reporta sin lanzar', async () => {
    const api = fakeApi({ pulls: { list: vi.fn().mockRejectedValue(httpError(403)) } });
    const result = await checkRepoAccess(api, 'acme', 'api');
    expect(result).toMatchObject({ ok: false, canReadPulls: false, canReadContents: true });
    expect(result.message).toContain('Pull requests');
  });

  it('falta el permiso de contenido: lo reporta sin lanzar', async () => {
    const api = fakeApi({ repos: { getContent: vi.fn().mockRejectedValue(httpError(404)) } });
    const result = await checkRepoAccess(api, 'acme', 'api');
    expect(result).toMatchObject({ ok: false, canReadPulls: true, canReadContents: false });
    expect(result.message).toContain('Contents');
  });

  it('401, límite de uso y 5xx en una prueba posterior lanzan AppError', async () => {
    for (const [status, code] of [
      [401, 'GITHUB_AUTH'],
      [500, 'GITHUB_UNAVAILABLE'],
    ] as const) {
      const api = fakeApi({ pulls: { list: vi.fn().mockRejectedValue(httpError(status)) } });
      await expect(checkRepoAccess(api, 'acme', 'api')).rejects.toMatchObject({ code });
    }
    const limited = fakeApi({
      repos: { getContent: vi.fn().mockRejectedValue(httpError(429)) },
    });
    await expect(checkRepoAccess(limited, 'acme', 'api')).rejects.toMatchObject({
      code: 'GITHUB_RATE_LIMIT',
    });
  });
});
