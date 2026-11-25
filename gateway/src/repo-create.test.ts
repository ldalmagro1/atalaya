import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db, GitHubApi } from '@atalaya/core';
import { Repo, defaultRepoConfig } from '@atalaya/contracts';
import { buildApp } from './app.js';
import { createTestDb } from './test-db.js';
import { fakeGitHub } from './test-github.js';

const TOKEN = 'tok-' + 'a1b2c3d4'.repeat(5);
const httpError = (status: number) =>
  Object.assign(new Error('detalle de GitHub'), { status, response: { headers: {} } });

describe('POST /api/repos verifica el repo en GitHub', () => {
  let app: FastifyInstance;
  let db: Db;

  async function start(octokit?: GitHubApi) {
    db = createTestDb();
    app = await buildApp({
      db,
      internalToken: TOKEN,
      tools: [],
      octokit,
      logger: { level: 'silent' },
    });
  }
  afterEach(async () => {
    await app.close();
    db.close();
  });

  const create = (payload: object = { owner: 'acme', name: 'api' }) =>
    app.inject({ method: 'POST', url: '/api/repos', payload });
  const saved = () => db.prepare('SELECT owner, name FROM gateway_repos').all();

  it('un repo existente se crea con la config por defecto, sin guardar la rama', async () => {
    const get = vi.fn(fakeGitHub().repos.get);
    await start(fakeGitHub({ repos: { get } }));
    const res = await create();
    expect(res.statusCode).toBe(201);
    expect(Repo.parse(res.json()).config).toEqual(defaultRepoConfig());
    expect(get).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', headers: {} });
  });

  it.each([
    [404, 404, 'REPO_NOT_FOUND_OR_NO_ACCESS'],
    [403, 404, 'REPO_NOT_FOUND_OR_NO_ACCESS'],
    [401, 502, 'GITHUB_AUTH'],
    [429, 429, 'GITHUB_RATE_LIMIT'],
    [500, 502, 'GITHUB_UNAVAILABLE'],
  ])('un %i de GitHub responde %i %s y no guarda nada', async (github, status, code) => {
    await start(fakeGitHub({ repos: { get: vi.fn().mockRejectedValue(httpError(github)) } }));
    const res = await create();
    expect(res.statusCode).toBe(status);
    expect(res.json()).toMatchObject({ code });
    expect(res.json().message).not.toContain('detalle de GitHub');
    expect(saved()).toEqual([]);
  });

  it('sin GITHUB_TOKEN: 503 GITHUB_NOT_CONFIGURED y no guarda nada', async () => {
    await start();
    const res = await create();
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: 'GITHUB_NOT_CONFIGURED' });
    expect(saved()).toEqual([]);
    expect((await app.inject({ url: '/api/repos' })).statusCode).toBe(200);
  });

  it('un body inválido responde 400 sin llamar a GitHub', async () => {
    const get = vi.fn();
    await start(fakeGitHub({ repos: { get } }));
    expect((await create({ owner: 'a/b', name: 'x' })).statusCode).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it('un duplicado responde 409 sin llamar de nuevo a GitHub', async () => {
    const get = vi.fn(fakeGitHub().repos.get);
    await start(fakeGitHub({ repos: { get } }));
    await create();
    const res = await create({ owner: 'ACME', name: 'Api' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'REPO_EXISTS' });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('dos altas simultáneas del mismo repo: una 201 y otra 409', async () => {
    await start(fakeGitHub());
    const codes = (await Promise.all([create(), create()])).map((res) => res.statusCode);
    expect(codes.sort()).toEqual([201, 409]);
    expect(saved()).toHaveLength(1);
  });
});
