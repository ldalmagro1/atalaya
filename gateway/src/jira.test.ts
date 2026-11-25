import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, type Db, type JiraProvider } from '@atalaya/core';
import { JiraCheckResult, Repo, defaultRepoConfig } from '@atalaya/contracts';
import { buildApp } from './app.js';
import { createTestDb } from './test-db.js';

const INTERNAL = 'tok-' + 'a1b2c3d4'.repeat(5);
const JIRA_TOKEN = 'jira_token_SECRETO_DE_PRUEBA_987654';

const fakeJira = (getProject = vi.fn().mockResolvedValue({ key: 'DEMO', name: 'Proyecto demo' })) =>
  ({ getProject }) satisfies JiraProvider;

describe('Jira', () => {
  let app: FastifyInstance;
  let db: Db;
  let logs: string[];

  async function start(
    options: Parameters<typeof buildApp>[0] extends infer O ? Partial<O> : never = {},
  ) {
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

  const createRepo = async () =>
    Repo.parse(
      (
        await app.inject({
          method: 'POST',
          url: '/api/repos',
          payload: { owner: 'acme', name: 'api' },
        })
      ).json(),
    );
  const putConfig = (id: number, jira: unknown) =>
    app.inject({
      method: 'PUT',
      url: `/api/repos/${id}/config`,
      payload: { ...defaultRepoConfig(), jira },
    });
  const check = (id: number) => app.inject({ method: 'POST', url: `/api/repos/${id}/jira/check` });

  describe('config.jira', () => {
    it('se guarda, se lee y se limpia desde la API', async () => {
      await start();
      const repo = await createRepo();
      expect(repo.config.jira).toBeNull();

      const saved = await putConfig(repo.id, { projectKey: 'DEMO' });
      expect(saved.statusCode).toBe(200);
      expect(saved.json().config.jira).toEqual({ projectKey: 'DEMO' });
      const read = await app.inject({ url: `/api/repos/${repo.id}` });
      expect(read.json().config.jira).toEqual({ projectKey: 'DEMO' });

      const cleared = await putConfig(repo.id, null);
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().config.jira).toBeNull();
    });

    it.each(['demo', 'D', '1ABC', 'DE-MO', 'DEMO ', ''])(
      'rechaza la key %j con 400 VALIDATION_ERROR',
      async (projectKey) => {
        await start();
        const repo = await createRepo();
        const res = await putConfig(repo.id, { projectKey });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      },
    );
  });

  describe('POST /api/repos/:id/jira/check', () => {
    it('sin credenciales: 503 JIRA_NOT_CONFIGURED y el resto de la plataforma funciona', async () => {
      await start();
      const repo = await createRepo();
      await putConfig(repo.id, { projectKey: 'DEMO' });
      const res = await check(repo.id);
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ code: 'JIRA_NOT_CONFIGURED' });
      expect(res.json().message).toContain('JIRA_API_TOKEN');

      expect((await app.inject({ url: '/api/health' })).statusCode).toBe(200);
      expect((await app.inject({ url: '/api/repos' })).statusCode).toBe(200);
    });

    it('repo no registrado: 404 REPO_NOT_FOUND', async () => {
      await start({ jiraProvider: fakeJira() });
      const res = await check(99);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'REPO_NOT_FOUND' });
    });

    it('id inválido: 400 VALIDATION_ERROR', async () => {
      await start({ jiraProvider: fakeJira() });
      const res = await check(-1);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('repo sin vínculo con Jira: 400 JIRA_NOT_LINKED y no llama a Jira', async () => {
      const getProject = vi.fn();
      await start({ jiraProvider: fakeJira(getProject) });
      const repo = await createRepo();
      const res = await check(repo.id);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'JIRA_NOT_LINKED' });
      expect(getProject).not.toHaveBeenCalled();
    });

    it('con proyecto accesible: ok, nombre y no modifica la config', async () => {
      const getProject = vi.fn().mockResolvedValue({ key: 'DEMO', name: 'Proyecto demo' });
      await start({ jiraProvider: fakeJira(getProject) });
      const repo = await createRepo();
      await putConfig(repo.id, { projectKey: 'DEMO' });
      const before = await app.inject({ url: `/api/repos/${repo.id}` });

      const res = await check(repo.id);
      expect(res.statusCode).toBe(200);
      expect(JiraCheckResult.parse(res.json())).toMatchObject({
        ok: true,
        projectKey: 'DEMO',
        projectName: 'Proyecto demo',
      });
      expect(getProject).toHaveBeenCalledWith('DEMO');
      expect((await app.inject({ url: `/api/repos/${repo.id}` })).json()).toEqual(before.json());
    });

    it.each([
      ['JIRA_AUTH', 502],
      ['JIRA_PROJECT_NOT_FOUND', 404],
      ['JIRA_UNAVAILABLE', 502],
    ])('traduce el error %s del proveedor a %i', async (code, status) => {
      const getProject = vi
        .fn()
        .mockRejectedValue(new AppError(code, 'Mensaje de prueba.', status));
      await start({ jiraProvider: fakeJira(getProject) });
      const repo = await createRepo();
      await putConfig(repo.id, { projectKey: 'DEMO' });
      const res = await check(repo.id);
      expect(res.statusCode).toBe(status);
      expect(res.json()).toMatchObject({ code });
    });
  });

  describe('GET /api/health', () => {
    it('jiraConfigured refleja si hay credenciales', async () => {
      await start();
      expect((await app.inject({ url: '/api/health' })).json().jiraConfigured).toBe(false);
      await app.close();
      db.close();

      await start({
        jira: {
          baseUrl: 'https://ejemplo.atlassian.net',
          email: 'a@ejemplo.test',
          apiToken: JIRA_TOKEN,
        },
      });
      expect((await app.inject({ url: '/api/health' })).json().jiraConfigured).toBe(true);
    });
  });

  it('las credenciales de Jira no aparecen en respuestas ni en logs', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchFn);
    try {
      await start({
        jira: {
          baseUrl: 'https://ejemplo.atlassian.net',
          email: 'a@ejemplo.test',
          apiToken: JIRA_TOKEN,
        },
      });
      const repo = await createRepo();
      await putConfig(repo.id, { projectKey: 'DEMO' });
      const res = await check(repo.id);
      expect(res.statusCode).toBe(502);
      expect(res.json()).toMatchObject({ code: 'JIRA_AUTH' });
      expect(res.body).not.toContain(JIRA_TOKEN);
      expect(logs.join('')).not.toContain(JIRA_TOKEN);
      expect(logs.join('')).not.toContain('a@ejemplo.test');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
