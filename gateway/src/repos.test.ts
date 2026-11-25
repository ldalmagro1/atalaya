import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@atalaya/core';
import { Repo, RepoListResponse, defaultRepoConfig } from '@atalaya/contracts';
import { buildApp } from './app.js';
import { createTestDb } from './test-db.js';
import { fakeGitHub } from './test-github.js';

const TOKEN = 'tok-' + 'a1b2c3d4'.repeat(5);
const AUTH = { 'x-atalaya-internal-token': TOKEN };

describe('repos', () => {
  let app: FastifyInstance;
  let db: Db;

  beforeEach(async () => {
    db = createTestDb();
    app = await buildApp({
      db,
      internalToken: TOKEN,
      tools: [],
      octokit: fakeGitHub(),
      logger: { level: 'silent' },
    });
  });
  afterEach(async () => {
    await app.close();
    db.close();
  });

  const create = (owner = 'acme', name = 'api') =>
    app.inject({ method: 'POST', url: '/api/repos', payload: { owner, name } });
  const createdRepo = async () => Repo.parse((await create()).json());
  const read = async (id: number) =>
    Repo.parse((await app.inject({ method: 'GET', url: `/api/repos/${id}` })).json());

  describe('migración', () => {
    it('crea gateway_repos y la registra una sola vez', () => {
      const tables = db
        .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((t) => t.name);
      expect(tables).toContain('gateway_repos');
      expect(
        db.prepare("SELECT name FROM core_migrations WHERE service = 'gateway'").all(),
      ).toEqual([{ name: '001_repos.sql' }]);
    });
  });

  describe('CRUD', () => {
    it('crea un repo con la config por defecto y tools vacío', async () => {
      const res = await create();
      expect(res.statusCode).toBe(201);
      const repo = Repo.parse(res.json());
      expect(repo).toMatchObject({ owner: 'acme', name: 'api', config: defaultRepoConfig() });
      expect(repo.config.tools).toEqual({});
    });

    it('rechaza un duplicado con 409 REPO_EXISTS, también con otras mayúsculas', async () => {
      await create();
      for (const [owner, name] of [
        ['acme', 'api'],
        ['ACME', 'Api'],
      ] as const) {
        const res = await create(owner, name);
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ code: 'REPO_EXISTS' });
      }
    });

    it.each([{}, { owner: 'acme' }, { owner: 'a/b', name: 'x' }, { owner: 'a', name: '..' }])(
      'rechaza el body %j con 400',
      async (payload) => {
        const res = await app.inject({ method: 'POST', url: '/api/repos', payload });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      },
    );

    it('lista y lee repos con su config parseada', async () => {
      const a = Repo.parse((await create('acme', 'api')).json());
      await create('acme', 'web');
      const list = RepoListResponse.parse(
        (await app.inject({ method: 'GET', url: '/api/repos' })).json(),
      );
      expect(list.repos.map((r) => r.name)).toEqual(['api', 'web']);
      const one = await app.inject({ method: 'GET', url: `/api/repos/${a.id}` });
      expect(one.statusCode).toBe(200);
      expect(Repo.parse(one.json()).id).toBe(a.id);
    });

    it('responde 404 REPO_NOT_FOUND con un id inexistente y 400 con uno inválido', async () => {
      const missing = await app.inject({ method: 'GET', url: '/api/repos/999' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'REPO_NOT_FOUND' });
      const bad = await app.inject({ method: 'GET', url: '/api/repos/abc' });
      expect(bad.statusCode).toBe(400);
    });

    const withTool = {
      ...defaultRepoConfig(),
      tools: { herramienta_nueva: { enabled: true, settings: { umbral: 3 } } },
    };
    /** Guarda una config directo en la base, como la dejaría la ruta de herramientas. */
    const seed = (id: number, config: string) =>
      db.prepare('UPDATE gateway_repos SET config_json = ? WHERE id = ?').run(config, id);
    const putConfig = (id: number, payload: object) =>
      app.inject({ method: 'PUT', url: `/api/repos/${id}/config`, payload });

    it('actualiza github y jira conservando tools, con una clave nueva y sin migrar', async () => {
      const { id } = await createdRepo();
      seed(id, JSON.stringify(withTool));
      const config = {
        ...withTool,
        github: { defaultBranch: 'main' },
        jira: { projectKey: 'ATAL' },
      };
      const migrationsBefore = db.prepare('SELECT count(*) AS n FROM core_migrations').get();
      db.prepare("UPDATE gateway_repos SET updated_at = '2000-01-01 00:00:00' WHERE id = ?").run(
        id,
      );
      const res = await putConfig(id, config);
      expect(res.statusCode).toBe(200);
      const repo = Repo.parse(res.json());
      expect(repo.config).toEqual(config);
      expect(repo.updatedAt).not.toBe('2000-01-01 00:00:00');
      expect((await read(id)).config).toEqual(config);
      expect(db.prepare('SELECT count(*) AS n FROM core_migrations').get()).toEqual(
        migrationsBefore,
      );
    });

    it.each([
      ['agrega una sección', { ...withTool.tools, otra: { enabled: false, settings: {} } }],
      ['quita una sección', {}],
      ['cambia settings', { herramienta_nueva: { enabled: true, settings: { umbral: 4 } } }],
      ['cambia enabled', { herramienta_nueva: { enabled: false, settings: { umbral: 3 } } }],
    ])('rechaza con 400 TOOLS_NOT_EDITABLE si %s y no guarda nada', async (_caso, tools) => {
      const { id } = await createdRepo();
      seed(id, JSON.stringify(withTool));
      const res = await putConfig(id, { ...withTool, jira: { projectKey: 'ATAL' }, tools });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'TOOLS_NOT_EDITABLE' });
      expect((await read(id)).config).toEqual(withTool);
    });

    it('repara una config inválida exigiendo las secciones de tools que se pueden leer', async () => {
      const { id } = await createdRepo();
      seed(id, JSON.stringify({ ...withTool, version: 2 }));
      expect((await putConfig(id, defaultRepoConfig())).statusCode).toBe(400);
      expect((await putConfig(id, withTool)).statusCode).toBe(200);
      expect((await read(id)).config).toEqual(withTool);
    });

    it('repara una config ilegible solo con tools vacío', async () => {
      const { id } = await createdRepo();
      seed(id, 'no es json');
      expect((await putConfig(id, withTool)).statusCode).toBe(400);
      expect((await putConfig(id, defaultRepoConfig())).statusCode).toBe(200);
      expect((await read(id)).config).toEqual(defaultRepoConfig());
    });

    it.each([
      ['version', { ...defaultRepoConfig(), version: 2 }],
      ['projectKey', { ...defaultRepoConfig(), jira: { projectKey: 'atal' } }],
      ['ToolId', { ...defaultRepoConfig(), tools: { 'Mala-Id': { enabled: true, settings: {} } } }],
      ['settings', { ...defaultRepoConfig(), tools: { x: { enabled: true, settings: 'no' } } }],
    ])('rechaza con 400 una config con %s inválido y no la guarda', async (_campo, payload) => {
      const { id } = await createdRepo();
      const res = await app.inject({ method: 'PUT', url: `/api/repos/${id}/config`, payload });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect((await read(id)).config).toEqual(defaultRepoConfig());
    });

    it('PUT sobre un repo inexistente da 404', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/repos/999/config',
        payload: defaultRepoConfig(),
      });
      expect(res.statusCode).toBe(404);
    });

    it('borra un repo', async () => {
      const { id } = await createdRepo();
      const del = () => app.inject({ method: 'DELETE', url: `/api/repos/${id}` });
      expect((await del()).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: `/api/repos/${id}` })).statusCode).toBe(404);
      expect((await del()).statusCode).toBe(404);
    });
  });

  describe('config guardada inválida', () => {
    it.each(['{"version":2}', 'no es json'])(
      'responde 500 INVALID_STORED_CONFIG con %s y no la repara',
      async (stored) => {
        const { id } = await createdRepo();
        db.prepare('UPDATE gateway_repos SET config_json = ? WHERE id = ?').run(stored, id);
        const res = await app.inject({ method: 'GET', url: `/api/repos/${id}` });
        expect(res.statusCode).toBe(500);
        expect(res.json()).toMatchObject({ code: 'INVALID_STORED_CONFIG' });
        expect(res.json<{ message: string }>().message).toContain('acme/api');
        expect(db.prepare('SELECT config_json FROM gateway_repos WHERE id = ?').get(id)).toEqual({
          config_json: stored,
        });
      },
    );
  });

  describe('GET /internal/repos/:owner/:name', () => {
    const internal = (url: string, headers: Record<string, string> = AUTH) =>
      app.inject({ method: 'GET', url, headers });

    it('devuelve el repo con su config con el token interno, sin distinguir mayúsculas', async () => {
      await create('Acme', 'Api');
      const res = await internal('/internal/repos/acme/api');
      expect(res.statusCode).toBe(200);
      expect(Repo.parse(res.json())).toMatchObject({ owner: 'Acme', config: defaultRepoConfig() });
    });

    it('responde 401 sin token o con token incorrecto', async () => {
      await create();
      for (const headers of [{}, { 'x-atalaya-internal-token': 'otro' }] as Record<
        string,
        string
      >[]) {
        const res = await internal('/internal/repos/acme/api', headers);
        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ code: 'INVALID_INTERNAL_TOKEN' });
        expect(res.body).not.toContain(TOKEN);
      }
    });

    it('responde 404 REPO_NOT_REGISTERED para un repo no registrado', async () => {
      const res = await internal('/internal/repos/acme/nada');
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'REPO_NOT_REGISTERED' });
    });

    it('no devuelve cabeceras CORS ni a un origen permitido', async () => {
      await create();
      const res = await internal('/internal/repos/acme/api', {
        ...AUTH,
        origin: 'http://127.0.0.1:5173',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('/api sigue con CORS para la web', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/repos',
        headers: { origin: 'http://127.0.0.1:5173' },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    });
  });
});
