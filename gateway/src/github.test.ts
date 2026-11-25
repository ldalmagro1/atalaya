import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db, GitHubApi } from '@atalaya/core';
import { GitHubStatus, Repo, RepoCheckResult } from '@atalaya/contracts';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { RepoStore } from './repos/repo-store.js';
import { createTestDb } from './test-db.js';
import { fakeGitHub } from './test-github.js';

const INTERNAL = 'tok-' + 'a1b2c3d4'.repeat(5);
const GH_TOKEN = 'github_pat_SECRETO_DE_PRUEBA_987654';

const httpError = (status: number, headers: Record<string, string> = {}) =>
  Object.assign(new Error(GH_TOKEN), { status, response: { headers } });

/** Cliente falso con espías en las llamadas que estos tests observan. */
function fakeOctokit(overrides: Parameters<typeof fakeGitHub>[0] = {}): GitHubApi {
  const base = fakeGitHub();
  return fakeGitHub({
    users: {
      getAuthenticated: vi.fn(base.users.getAuthenticated),
      ...overrides.users,
    },
    repos: { get: vi.fn(base.repos.get), ...overrides.repos },
    pulls: overrides.pulls,
  });
}

describe('GitHub', () => {
  let app: FastifyInstance;
  let db: Db;
  let logs: string[];

  async function start(options: { octokit?: GitHubApi; githubToken?: string | null } = {}) {
    db = createTestDb();
    logs = [];
    app = await buildApp({
      db,
      internalToken: INTERNAL,
      tools: [],
      ...options,
      logger: { level: 'debug', stream: { write: (message) => logs.push(message) } },
    });
  }
  afterEach(async () => {
    await app.close();
    db.close();
  });

  /** Inserta el repo sin pasar por el alta, que verifica en GitHub. */
  const seedRepo = () => new RepoStore(db).create('acme', 'api');
  const check = (id: number) =>
    app.inject({ method: 'POST', url: `/api/repos/${id}/github/check` });

  describe('GET /api/github/status', () => {
    it('sin token: configured false con 200 (no 503)', async () => {
      await start();
      const res = await app.inject({ method: 'GET', url: '/api/github/status' });
      expect(res.statusCode).toBe(200);
      expect(GitHubStatus.parse(res.json())).toEqual({
        configured: false,
        valid: false,
        login: null,
      });
    });

    it('con token válido: devuelve el login', async () => {
      await start({ octokit: fakeOctokit() });
      const res = await app.inject({ method: 'GET', url: '/api/github/status' });
      expect(res.json()).toEqual({ configured: true, valid: true, login: 'lucas' });
    });

    it('con token rechazado: valid false', async () => {
      await start({
        octokit: fakeOctokit({
          users: { getAuthenticated: vi.fn().mockRejectedValue(httpError(401)) },
        }),
      });
      const res = await app.inject({ method: 'GET', url: '/api/github/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ configured: true, valid: false, login: null });
    });

    it('con GitHub caído: 502 GITHUB_UNAVAILABLE', async () => {
      await start({
        octokit: fakeOctokit({
          users: { getAuthenticated: vi.fn().mockRejectedValue(httpError(503)) },
        }),
      });
      const res = await app.inject({ method: 'GET', url: '/api/github/status' });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toMatchObject({ code: 'GITHUB_UNAVAILABLE' });
    });
  });

  describe('POST /api/repos/:id/github/check', () => {
    it('sin token: 503 GITHUB_NOT_CONFIGURED', async () => {
      await start();
      const repo = seedRepo();
      const res = await check(repo.id);
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ code: 'GITHUB_NOT_CONFIGURED' });
    });

    it('repo no registrado: 404 REPO_NOT_FOUND', async () => {
      await start({ octokit: fakeOctokit() });
      const res = await check(99);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'REPO_NOT_FOUND' });
    });

    it('id inválido: 400 VALIDATION_ERROR', async () => {
      await start({ octokit: fakeOctokit() });
      const res = await check(-1);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('con acceso completo: ok y guarda defaultBranch en la config', async () => {
      const octokit = fakeOctokit();
      await start({ octokit });
      const repo = seedRepo();
      expect(repo.config.github.defaultBranch).toBeNull();

      const res = await check(repo.id);
      expect(res.statusCode).toBe(200);
      expect(RepoCheckResult.parse(res.json())).toMatchObject({
        ok: true,
        repoFound: true,
        canReadPulls: true,
        canReadContents: true,
        canWritePulls: 'unverified',
        defaultBranch: 'develop',
      });
      expect(octokit.repos.get).toHaveBeenCalledWith({ owner: 'acme', repo: 'api' });

      const saved = Repo.parse((await app.inject({ url: `/api/repos/${repo.id}` })).json());
      expect(saved.config.github.defaultBranch).toBe('develop');
      expect(saved.config.tools).toEqual({});
    });

    it('permiso de PRs ausente: 200 con ok false y canReadPulls false', async () => {
      await start({
        octokit: fakeOctokit({ pulls: { list: vi.fn().mockRejectedValue(httpError(403)) } }),
      });
      const repo = seedRepo();
      const res = await check(repo.id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ ok: false, canReadPulls: false, canReadContents: true });
    });

    it.each([
      ['401', httpError(401), 502, 'GITHUB_AUTH'],
      ['404', httpError(404), 404, 'REPO_NOT_FOUND_OR_NO_ACCESS'],
      [
        'límite de uso',
        httpError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' }),
        429,
        'GITHUB_RATE_LIMIT',
      ],
      ['5xx', httpError(500), 502, 'GITHUB_UNAVAILABLE'],
    ])('error %s de GitHub: %i %s', async (_name, error, status, code) => {
      await start({ octokit: fakeOctokit({ repos: { get: vi.fn().mockRejectedValue(error) } }) });
      const repo = seedRepo();
      const res = await check(repo.id);
      expect(res.statusCode).toBe(status);
      expect(res.json()).toMatchObject({ code });
      expect(res.json().message.length).toBeGreaterThan(10);
    });
  });

  describe('GET /api/health', () => {
    it('githubConfigured refleja si hay token', async () => {
      await start();
      expect((await app.inject({ url: '/api/health' })).json().githubConfigured).toBe(false);
      await app.close();
      db.close();

      await start({ githubToken: GH_TOKEN });
      expect((await app.inject({ url: '/api/health' })).json().githubConfigured).toBe(true);
    });
  });

  it('el token de GitHub no aparece en respuestas ni en logs', async () => {
    await start({
      githubToken: GH_TOKEN,
      octokit: fakeOctokit({ repos: { get: vi.fn().mockRejectedValue(httpError(401)) } }),
    });
    const repo = seedRepo();
    const responses = [
      await app.inject({ url: '/api/github/status' }),
      await check(repo.id),
      await app.inject({ url: '/api/health' }),
      await app.inject({ url: '/api/repos' }),
    ].map((res) => res.body);
    const output = [...responses, ...logs].join('\n');
    expect(logs.length).toBeGreaterThan(0);
    expect(output).not.toContain(GH_TOKEN);
  });
});

describe('loadConfig: GITHUB_TOKEN', () => {
  const env = { INTERNAL_TOKEN: 'a'.repeat(32) };

  it('es opcional: sin él o vacío, githubToken es null', () => {
    expect(loadConfig(env).githubToken).toBeNull();
    expect(loadConfig({ ...env, GITHUB_TOKEN: '  ' }).githubToken).toBeNull();
  });

  it('lo lee sin espacios sobrantes', () => {
    expect(loadConfig({ ...env, GITHUB_TOKEN: ` ${GH_TOKEN}\n` }).githubToken).toBe(GH_TOKEN);
  });
});
