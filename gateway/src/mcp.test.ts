import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MCP_CLIENT_HEADER, MCP_CLIENT_VALUE } from '@atalaya/contracts';
import { listenLocal } from '@atalaya/core';
import { buildApp } from './app.js';
import { startMcpService, TOKEN, type McpTestService } from './mcp-test-service.js';
import { createTestDb } from './test-db.js';

const CLIENT = { [MCP_CLIENT_HEADER]: MCP_CLIENT_VALUE };

describe('rutas /api/mcp', () => {
  let service: McpTestService;
  let gateway: FastifyInstance;
  let logs: string[];

  async function gatewayFor(baseUrl: string) {
    return buildApp({
      db: createTestDb(),
      internalToken: TOKEN,
      tools: [{ id: 'pr_reviewer', baseUrl }],
      healthTimeoutMs: 500,
      proxyTimeoutMs: 2000,
      logger: { level: 'debug', stream: { write: (message) => logs.push(message) } },
    });
  }

  beforeEach(async () => {
    logs = [];
    service = await startMcpService();
    gateway = await gatewayFor(service.baseUrl);
  });

  afterEach(async () => {
    await gateway.close();
    await service.app.close();
  });

  describe('GET /api/mcp/manifest', () => {
    it('lista las herramientas y prompts con el nombre prefijado por el id', async () => {
      const res = await gateway.inject({
        method: 'GET',
        url: '/api/mcp/manifest',
        headers: CLIENT,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tools.map((t: { name: string; access: string }) => [t.name, t.access])).toEqual([
        ['pr_reviewer_get_pr', 'read'],
        ['pr_reviewer_save_draft', 'draft'],
      ]);
      expect(body.tools[0].inputSchema).toMatchObject({ type: 'object' });
      expect(body.prompts[0]).toMatchObject({ name: 'pr_reviewer_review' });
    });

    it('omite el servicio caído y sigue con una lista vacía', async () => {
      const down = await startMcpService();
      const baseUrl = down.baseUrl;
      await down.app.close();
      const g = await gatewayFor(baseUrl);
      const res = await g.inject({ method: 'GET', url: '/api/mcp/manifest', headers: CLIENT });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ tools: [], prompts: [] });
      await g.close();
    });

    it('falla con un error claro si un servicio declara una herramienta write', async () => {
      // Un servicio que no usa la fábrica y declara `write`.
      const bad = Fastify();
      bad.get('/internal/mcp', async () => ({
        tools: [{ name: 'publish', description: 'p', inputSchema: {}, access: 'write' }],
        prompts: [],
      }));
      await listenLocal(bad, 0);
      const { port } = bad.server.address() as { port: number };
      const g = await gatewayFor(`http://127.0.0.1:${port}`);
      const res = await g.inject({ method: 'GET', url: '/api/mcp/manifest', headers: CLIENT });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toMatchObject({ code: 'MCP_INVALID_DECLARATION' });
      expect(res.json().message).toMatch(/read.*draft/);
      await g.close();
      await bad.close();
    });
  });

  describe('POST /api/mcp/tools/:name', () => {
    const call = (name: string, payload: unknown, headers: Record<string, string> = CLIENT) =>
      gateway.inject({
        method: 'POST',
        url: `/api/mcp/tools/${name}`,
        headers,
        payload: payload as object,
      });

    it('reenvía al servicio con el token interno y devuelve el resultado', async () => {
      const res = await call('pr_reviewer_get_pr', { arguments: { text: 'hola' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ result: 'PR: hola' });
      expect(service.calls).toEqual([{ name: 'get_pr', args: { text: 'hola' } }]);
      const draft = await call('pr_reviewer_save_draft', { arguments: { text: 'x' } });
      expect(draft.json()).toEqual({ result: { saved: true } });
    });

    it('devuelve 404 si el nombre no existe', async () => {
      const res = await call('pr_reviewer_nada', { arguments: {} });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'MCP_TOOL_NOT_FOUND' });
    });

    it('devuelve 502 si el servicio no responde', async () => {
      // Un servicio que declara la herramienta pero corta la conexión al llamarla.
      const flaky = Fastify();
      flaky.get('/internal/mcp', async () => ({
        tools: [{ name: 'get_pr', description: 'd', inputSchema: {}, access: 'read' }],
        prompts: [],
      }));
      flaky.post('/internal/mcp/tools/:name', async (request) => {
        request.raw.socket.destroy();
        return {};
      });
      await listenLocal(flaky, 0);
      const { port } = flaky.server.address() as { port: number };
      const g2 = await gatewayFor(`http://127.0.0.1:${port}`);
      const res = await g2.inject({
        method: 'POST',
        url: '/api/mcp/tools/pr_reviewer_get_pr',
        headers: CLIENT,
        payload: { arguments: {} },
      });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toMatchObject({ code: 'TOOL_UNAVAILABLE' });
      await g2.close();
      await flaky.close();
    });

    it('devuelve el error 4xx del servicio con su forma { code, message }', async () => {
      const res = await call('pr_reviewer_get_pr', { arguments: { text: 5 } });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rechaza un cuerpo inválido con 400', async () => {
      const res = await call('pr_reviewer_get_pr', { arguments: 'no-es-objeto' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('encabezado X-Atalaya-Client', () => {
    it('responde 403 sin el encabezado (o con otro valor) en las dos rutas', async () => {
      const responses = [
        await gateway.inject({ method: 'GET', url: '/api/mcp/manifest' }),
        await gateway.inject({
          method: 'GET',
          url: '/api/mcp/manifest',
          headers: { [MCP_CLIENT_HEADER]: 'web' },
        }),
        await gateway.inject({
          method: 'POST',
          url: '/api/mcp/tools/pr_reviewer_get_pr',
          payload: { arguments: { text: 'x' } },
        }),
      ];
      for (const res of responses) {
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ code: 'MCP_CLIENT_REQUIRED' });
      }
      expect(service.calls).toEqual([]);
    });

    it('responde el preflight de CORS a un origen permitido y no a uno ajeno', async () => {
      const ok = await gateway.inject({
        method: 'OPTIONS',
        url: '/api/mcp/manifest',
        headers: {
          origin: 'http://127.0.0.1:5173',
          'access-control-request-method': 'GET',
          'access-control-request-headers': MCP_CLIENT_HEADER,
        },
      });
      expect(ok.statusCode).toBe(204);
      const ajeno = await gateway.inject({
        method: 'OPTIONS',
        url: '/api/mcp/manifest',
        headers: {
          origin: 'https://sitio-ajeno.example',
          'access-control-request-method': 'GET',
          'access-control-request-headers': MCP_CLIENT_HEADER,
        },
      });
      expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  it('no registra tokens ni cuerpos de respuesta en los logs', async () => {
    await gateway.inject({ method: 'GET', url: '/api/mcp/manifest', headers: CLIENT });
    await gateway.inject({
      method: 'POST',
      url: '/api/mcp/tools/pr_reviewer_get_pr',
      headers: CLIENT,
      payload: { arguments: { text: 'contenido-secreto-del-pr' } },
    });
    const all = logs.join('');
    expect(all).not.toContain(TOKEN);
    expect(all).not.toContain('contenido-secreto-del-pr');
  });
});
