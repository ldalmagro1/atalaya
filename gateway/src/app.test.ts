import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServiceApp, listenLocal } from '@atalaya/core';
import { ALLOWED_ORIGINS, buildApp } from './app.js';

const TOKEN = 'tok-' + 'a1b2c3d4'.repeat(5);
const COOKIE = 'sesion=valor-de-cookie-secreta';
const AUTHORIZATION = 'Bearer valor-de-authorization-secreto';

interface Seen {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

/** Servicio de prueba real (con la fábrica de core) que registra lo que recibe. */
async function startFakeService(
  token: string,
): Promise<{ app: FastifyInstance; baseUrl: string; seen: Seen[] }> {
  const seen: Seen[] = [];
  const app = createServiceApp({
    id: 'pr_reviewer',
    name: 'Revisor de prueba',
    description: 'Servicio falso para los tests.',
    version: '1.2.3',
    internalToken: token,
    logger: { level: 'silent' },
  });
  app.addHook('preHandler', async (request) => {
    seen.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
    });
  });
  app.get('/pulls', async (_request, reply) => {
    reply.header('set-cookie', 'servicio=1');
    return { items: [] };
  });
  app.post('/pulls', async (request, reply) => reply.code(201).send({ recibido: request.body }));
  await listenLocal(app, 0);
  const { port } = app.server.address() as AddressInfo;
  return { app, baseUrl: `http://127.0.0.1:${port}`, seen };
}

/** URL de un puerto en el que no escucha nadie. */
async function closedPortUrl(): Promise<string> {
  const { app, baseUrl } = await startFakeService(TOKEN);
  await app.close();
  return baseUrl;
}

describe('gateway', () => {
  let service: Awaited<ReturnType<typeof startFakeService>>;
  let gateway: FastifyInstance;
  let logs: string[];

  beforeEach(async () => {
    service = await startFakeService(TOKEN);
    logs = [];
    gateway = await buildApp({
      internalToken: TOKEN,
      tools: [{ id: 'pr_reviewer', baseUrl: service.baseUrl }],
      healthTimeoutMs: 500,
      proxyTimeoutMs: 2000,
      logger: { level: 'debug', stream: { write: (message) => logs.push(message) } },
    });
  });

  afterEach(async () => {
    await gateway.close();
    await service.app.close();
  });

  describe('GET /api/health', () => {
    it('agrega la salud de las herramientas con su versión', async () => {
      const res = await gateway.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        ok: true,
        tools: [{ id: 'pr_reviewer', ok: true, version: '1.2.3' }],
      });
    });

    it('marca ok: false una herramienta caída sin caerse', async () => {
      const down = await buildApp({
        internalToken: TOKEN,
        tools: [{ id: 'pr_reviewer', baseUrl: await closedPortUrl() }],
        healthTimeoutMs: 500,
        logger: { level: 'silent' },
      });
      const res = await down.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        ok: false,
        tools: [{ id: 'pr_reviewer', ok: false, version: null }],
      });
      await down.close();
    });

    it('marca ok: false una herramienta que rechaza el token interno', async () => {
      const wrong = await buildApp({
        internalToken: 'otro-' + 'z'.repeat(32),
        tools: [{ id: 'pr_reviewer', baseUrl: service.baseUrl }],
        logger: { level: 'silent' },
      });
      const res = await wrong.inject({ method: 'GET', url: '/api/health' });
      expect(res.json()).toMatchObject({ ok: false });
      await wrong.close();
    });
  });

  describe('GET /api/tools', () => {
    it('lista las herramientas con su manifiesto', async () => {
      const res = await gateway.inject({ method: 'GET', url: '/api/tools' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        tools: [
          {
            id: 'pr_reviewer',
            name: 'Revisor de prueba',
            description: 'Servicio falso para los tests.',
            version: '1.2.3',
          },
        ],
      });
    });
  });

  describe('errores', () => {
    it('validación: un id de herramienta mal formado → 400 VALIDATION_ERROR', async () => {
      const res = await gateway.inject({ method: 'GET', url: '/api/tools/Id%20Malo/pulls' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String) });
    });

    it('ruta inexistente → 404 con forma { code, message }', async () => {
      for (const url of ['/api/nada', '/otra-cosa']) {
        const res = await gateway.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
      }
    });
  });

  describe('CORS', () => {
    it.each(ALLOWED_ORIGINS)('permite el origen %s', async (origin) => {
      const res = await gateway.inject({ method: 'GET', url: '/api/health', headers: { origin } });
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    });

    it('no da permiso CORS a otros orígenes, tampoco en el preflight', async () => {
      const origin = 'http://evil.example';
      const get = await gateway.inject({ method: 'GET', url: '/api/health', headers: { origin } });
      expect(get.headers['access-control-allow-origin']).toBeUndefined();
      const preflight = await gateway.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: { origin, 'access-control-request-method': 'GET' },
      });
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('proxy', () => {
    it('reenvía con el token interno la ruta restante, el método, el cuerpo y la query', async () => {
      const res = await gateway.inject({
        method: 'POST',
        url: '/api/tools/pr_reviewer/pulls?estado=abierto',
        headers: { 'content-type': 'application/json' },
        payload: { titulo: 'hola' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ recibido: { titulo: 'hola' } });
      const request = service.seen.find((r) => r.method === 'POST');
      expect(request?.url).toBe('/pulls?estado=abierto');
      expect(request?.headers['x-atalaya-internal-token']).toBe(TOKEN);
    });

    it('no reenvía Cookie ni Authorization, ni deja que el navegador fije el token', async () => {
      await gateway.inject({
        method: 'GET',
        url: '/api/tools/pr_reviewer/pulls',
        headers: {
          cookie: COOKIE,
          authorization: AUTHORIZATION,
          'x-atalaya-internal-token': 'token-falso-del-navegador',
        },
      });
      const request = service.seen.find((r) => r.method === 'GET' && r.url === '/pulls');
      expect(request?.headers.cookie).toBeUndefined();
      expect(request?.headers.authorization).toBeUndefined();
      expect(request?.headers['x-atalaya-internal-token']).toBe(TOKEN);
    });

    it('no devuelve las cookies que fija el servicio', async () => {
      const res = await gateway.inject({ method: 'GET', url: '/api/tools/pr_reviewer/pulls' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('herramienta desconocida → 404 TOOL_NOT_FOUND', async () => {
      const res = await gateway.inject({ method: 'GET', url: '/api/tools/otra/pulls' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'TOOL_NOT_FOUND', message: expect.any(String) });
    });

    it('servicio caído → 502 TOOL_UNAVAILABLE', async () => {
      const down = await buildApp({
        internalToken: TOKEN,
        tools: [{ id: 'pr_reviewer', baseUrl: await closedPortUrl() }],
        logger: { level: 'silent' },
      });
      const res = await down.inject({ method: 'GET', url: '/api/tools/pr_reviewer/pulls' });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ code: 'TOOL_UNAVAILABLE', message: expect.any(String) });
      await down.close();
    });

    it('servicio que no responde a tiempo → 502 TOOL_UNAVAILABLE', async () => {
      const slow = await buildApp({
        internalToken: TOKEN,
        tools: [{ id: 'pr_reviewer', baseUrl: service.baseUrl }],
        fetchFn: (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
        proxyTimeoutMs: 50,
        logger: { level: 'silent' },
      });
      const res = await slow.inject({ method: 'GET', url: '/api/tools/pr_reviewer/pulls' });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toMatchObject({ code: 'TOOL_UNAVAILABLE' });
      await slow.close();
    });

    it('no expone las rutas internas del servicio ni deja salir de la herramienta', async () => {
      for (const url of [
        '/api/tools/pr_reviewer/internal/health',
        '/api/tools/pr_reviewer/internal/manifest',
        '/api/tools/pr_reviewer/%2e%2e/internal/health',
      ]) {
        const res = await gateway.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(404);
      }
      expect(service.seen).toHaveLength(0);
    });
  });

  describe('secretos', () => {
    it('ni las respuestas ni los logs contienen el token interno, Cookie ni Authorization', async () => {
      const sensitive = { cookie: COOKIE, authorization: AUTHORIZATION };
      const responses = await Promise.all([
        gateway.inject({ method: 'GET', url: '/api/health', headers: sensitive }),
        gateway.inject({ method: 'GET', url: '/api/tools', headers: sensitive }),
        gateway.inject({ method: 'GET', url: '/api/tools/pr_reviewer/pulls', headers: sensitive }),
        gateway.inject({ method: 'GET', url: '/api/tools/otra/pulls', headers: sensitive }),
        gateway.inject({ method: 'GET', url: '/api/tools/Id%20Malo/x', headers: sensitive }),
        gateway.inject({ method: 'GET', url: '/api/nada', headers: sensitive }),
      ]);
      const down = await buildApp({
        internalToken: TOKEN,
        tools: [{ id: 'pr_reviewer', baseUrl: await closedPortUrl() }],
        logger: { level: 'debug', stream: { write: (message) => logs.push(message) } },
      });
      responses.push(
        await down.inject({
          method: 'GET',
          url: '/api/tools/pr_reviewer/pulls',
          headers: sensitive,
        }),
        await down.inject({ method: 'GET', url: '/api/health', headers: sensitive }),
      );
      await down.close();

      const output = [
        ...responses.map((res) => `${JSON.stringify(res.headers)}${res.body}`),
        ...logs,
      ].join('\n');
      expect(logs.length).toBeGreaterThan(0);
      expect(output).not.toContain(TOKEN);
      expect(output).not.toContain(COOKIE);
      expect(output).not.toContain(AUTHORIZATION);
    });
  });
});
