import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createServiceApp,
  listenLocal,
  settingsValidator,
  type CreateServiceAppOptions,
} from '@atalaya/core';
import { InvalidSettingsResponse, Repo, RepoDetail, toolsResponseSchema } from '@atalaya/contracts';
import { buildApp } from './app.js';
import { createTestDb } from './test-db.js';
import { fakeGitHub } from './test-github.js';
import { registeredTools } from './tools.config.js';
import type { FetchFn } from './upstream.js';

const TOKEN = 'tok-' + 'a1b2c3d4'.repeat(5);
const DEFAULTS = { umbral: 3 };
const settingsSchema = z.object({ umbral: z.number().int().min(1) });

const open: { close: () => Promise<unknown> }[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((app) => app.close()));
});

/** Servicio de prueba: solo la fábrica de core, sin nada propio del gateway. */
async function startService(id: string, options: Partial<CreateServiceAppOptions> = {}) {
  const app = createServiceApp({
    id,
    name: 'Pronóstico',
    description: 'Servicio de prueba.',
    version: '1.0.0',
    internalToken: TOKEN,
    logger: { level: 'silent' },
    defaultSettings: DEFAULTS,
    validateSettings: settingsValidator(settingsSchema),
    ...options,
  });
  open.push(app);
  await listenLocal(app, 0);
  const { port } = app.server.address() as AddressInfo;
  return { app, entry: { id, baseUrl: `http://127.0.0.1:${port}` } };
}

async function startGateway(tools: { id: string; baseUrl: string }[], fetchFn?: FetchFn) {
  const db = createTestDb();
  const gateway = await buildApp({
    db,
    internalToken: TOKEN,
    tools,
    fetchFn,
    octokit: fakeGitHub(),
    healthTimeoutMs: 500,
    proxyTimeoutMs: 500,
    logger: { level: 'silent' },
  });
  open.push(gateway);
  const created = await gateway.inject({
    method: 'POST',
    url: '/api/repos',
    payload: { owner: 'acme', name: 'api' },
  });
  return { gateway, db, id: Repo.parse(created.json()).id };
}

const put = (gateway: FastifyInstance, id: number | string, toolId: string, payload: object) =>
  gateway.inject({ method: 'PUT', url: `/api/repos/${id}/tools/${toolId}`, payload });
const detail = async (gateway: FastifyInstance, id: number) =>
  RepoDetail.parse((await gateway.inject({ method: 'GET', url: `/api/repos/${id}` })).json());

describe('registrar una herramienta nueva', () => {
  it('con solo sumarla al registro aparece en /api/tools y acepta su configuración', async () => {
    const reviewer = await startService('pr_reviewer');
    const forecast = await startService('forecast');
    const base = registeredTools({ toolPorts: { pr_reviewer: 1 } });
    expect(base.map((tool) => tool.id)).toEqual(['pr_reviewer']);
    const { gateway, id } = await startGateway([reviewer.entry, forecast.entry]);

    const list = toolsResponseSchema.parse(
      (await gateway.inject({ method: 'GET', url: '/api/tools' })).json(),
    );
    expect(list.tools).toContainEqual({
      id: 'forecast',
      name: 'Pronóstico',
      description: 'Servicio de prueba.',
      version: '1.0.0',
      defaultSettings: DEFAULTS,
    });

    const res = await put(gateway, id, 'forecast', { enabled: true, settings: { umbral: 7 } });
    expect(res.statusCode).toBe(200);
    expect((await detail(gateway, id)).config.tools).toEqual({
      forecast: { enabled: true, settings: { umbral: 7 } },
    });
  });
});

describe('PUT /api/repos/:id/tools/:toolId', () => {
  let service: Awaited<ReturnType<typeof startService>>;
  let gateway: FastifyInstance;
  let id: number;

  beforeEach(async () => {
    service = await startService('forecast');
    ({ gateway, id } = await startGateway([service.entry]));
  });

  const save = (enabled: boolean, settings: object) =>
    put(gateway, id, 'forecast', { enabled, settings });
  const savedTools = async () => (await detail(gateway, id)).config.tools;

  it('guarda los valores normalizados por el servicio y responde el repo', async () => {
    const res = await save(true, { umbral: 5, sobra: 'x' });
    expect(res.statusCode).toBe(200);
    expect(Repo.parse(res.json()).config.tools).toEqual({
      forecast: { enabled: true, settings: { umbral: 5 } },
    });
  });

  it('rechaza settings inválidos con 400 y el detalle del servicio, sin guardar', async () => {
    await save(true, { umbral: 5 });
    const res = await save(true, { umbral: 0 });
    expect(res.statusCode).toBe(400);
    expect(InvalidSettingsResponse.parse(res.json()).errors).toEqual([
      { path: 'umbral', message: expect.any(String) },
    ]);
    expect(await savedTools()).toEqual({ forecast: { enabled: true, settings: { umbral: 5 } } });
  });

  it('habilitar y deshabilitar no borra los settings', async () => {
    for (const enabled of [true, false, true]) {
      expect((await save(enabled, { umbral: 9 })).statusCode).toBe(200);
      expect(await savedTools()).toEqual({ forecast: { enabled, settings: { umbral: 9 } } });
    }
  });

  it('conserva la config de github, jira y las demás herramientas', async () => {
    const other = await startService('linter');
    const two = await startGateway([service.entry, other.entry]);
    await put(two.gateway, two.id, 'linter', { enabled: true, settings: { umbral: 1 } });
    await two.gateway.inject({
      method: 'PUT',
      url: `/api/repos/${two.id}/config`,
      payload: {
        ...(await detail(two.gateway, two.id)).config,
        jira: { projectKey: 'DEMO' },
      },
    });
    await put(two.gateway, two.id, 'forecast', { enabled: true, settings: { umbral: 2 } });
    expect((await detail(two.gateway, two.id)).config).toMatchObject({
      jira: { projectKey: 'DEMO' },
      tools: {
        linter: { enabled: true, settings: { umbral: 1 } },
        forecast: { enabled: true, settings: { umbral: 2 } },
      },
    });
  });

  it('responde 404 TOOL_NOT_FOUND con una herramienta no registrada', async () => {
    const res = await put(gateway, id, 'nada', { enabled: true, settings: {} });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'TOOL_NOT_FOUND' });
  });

  it('responde 404 REPO_NOT_FOUND con un repo inexistente', async () => {
    const res = await put(gateway, 999, 'forecast', { enabled: true, settings: DEFAULTS });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'REPO_NOT_FOUND' });
  });

  it.each([
    ['id inválido', 'abc', 'forecast', { enabled: true, settings: {} }],
    ['toolId mal formado', 1, 'Mal-Id', { enabled: true, settings: {} }],
    ['sin enabled', 1, 'forecast', { settings: {} }],
    ['sin settings', 1, 'forecast', { enabled: false }],
    ['settings que no es un objeto', 1, 'forecast', { enabled: true, settings: 'x' }],
  ])('responde 400 VALIDATION_ERROR con %s', async (_caso, repoId, toolId, payload) => {
    const res = await put(gateway, repoId, toolId, payload);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('responde 502 TOOL_UNAVAILABLE con el servicio caído, sin guardar', async () => {
    await service.app.close();
    const res = await save(true, DEFAULTS);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ code: 'TOOL_UNAVAILABLE' });
    expect(await savedTools()).toEqual({});
  });

  it.each([
    ['un error 500', () => new Response('boom', { status: 500 })],
    ['un error 404', () => Response.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })],
    ['otra forma', () => Response.json({ valido: true })],
    ['algo que no es JSON', () => new Response('ok')],
  ])('responde 502 si el servicio contesta %s, sin guardar', async (_caso, reply) => {
    const fake = await startGateway([service.entry], async () => reply());
    const res = await put(fake.gateway, fake.id, 'forecast', {
      enabled: true,
      settings: DEFAULTS,
    });
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain(TOKEN);
    expect(fake.db.prepare('SELECT config_json FROM gateway_repos').get()).toMatchObject({
      config_json: expect.stringContaining('"tools":{}'),
    });
  });

  it('no pisa lo que se guardó mientras el servicio validaba', async () => {
    const racing = await startGateway([service.entry], async () => {
      racing.db.prepare('UPDATE gateway_repos SET config_json = ?').run(
        JSON.stringify({
          version: 1,
          github: { defaultBranch: 'develop' },
          jira: null,
          tools: {},
        }),
      );
      return Response.json({ ok: true, settings: DEFAULTS });
    });
    const res = await put(racing.gateway, racing.id, 'forecast', {
      enabled: true,
      settings: DEFAULTS,
    });
    expect(Repo.parse(res.json()).config.github.defaultBranch).toBe('develop');
  });
});

describe('GET /api/repos/:id → toolsResolved', () => {
  it('aplica los valores por defecto sin sección guardada, deshabilitada', async () => {
    const service = await startService('forecast');
    const { gateway, id } = await startGateway([service.entry]);
    const repo = await detail(gateway, id);
    expect(repo.toolsResolved).toEqual({ forecast: { enabled: false, settings: DEFAULTS } });
    expect(repo.config.tools).toEqual({});
  });

  it('usa la sección guardada sin mezclarla con los valores por defecto', async () => {
    const service = await startService('forecast');
    const { gateway, id } = await startGateway([service.entry]);
    await put(gateway, id, 'forecast', { enabled: true, settings: { umbral: 8 } });
    expect((await detail(gateway, id)).toolsResolved).toEqual({
      forecast: { enabled: true, settings: { umbral: 8 } },
    });
  });

  it('con el servicio caído usa lo guardado y marca unavailable, sin afectar a las demás', async () => {
    const down = await startService('forecast');
    const up = await startService('linter');
    const { gateway, id } = await startGateway([down.entry, up.entry]);
    await put(gateway, id, 'forecast', { enabled: true, settings: { umbral: 8 } });
    await down.app.close();
    expect((await detail(gateway, id)).toolsResolved).toEqual({
      forecast: { enabled: true, settings: { umbral: 8 }, unavailable: true },
      linter: { enabled: false, settings: DEFAULTS },
    });
  });

  it('con el servicio caído y sin sección devuelve settings vacíos y unavailable', async () => {
    const down = await startService('forecast');
    const { gateway, id } = await startGateway([down.entry]);
    await down.app.close();
    expect((await detail(gateway, id)).toolsResolved).toEqual({
      forecast: { enabled: false, settings: {}, unavailable: true },
    });
  });
});
