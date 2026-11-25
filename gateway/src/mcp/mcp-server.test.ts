import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MCP_CLIENT_HEADER, MCP_CLIENT_VALUE } from '@atalaya/contracts';
import { listenLocal } from '@atalaya/core';
import { buildApp } from '../app.js';
import { startMcpService, TOKEN, type McpTestService } from '../mcp-test-service.js';
import { createTestDb } from '../test-db.js';
import { CLIENT_HEADER, CLIENT_VALUE, createMcpServer } from './mcp-server.js';

async function connect(gatewayUrl: string, log: (m: string) => void = () => undefined) {
  const server = createMcpServer({ gatewayUrl, log, manifestTimeoutMs: 1000, callTimeoutMs: 2000 });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'prueba', version: '0.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, server };
}

const textOf = (result: unknown): string =>
  (result as { content: { type: string; text: string }[] }).content[0]!.text;

describe('proceso MCP', () => {
  let service: McpTestService;
  let gateway: FastifyInstance;
  let gatewayUrl: string;

  beforeEach(async () => {
    service = await startMcpService();
    gateway = await buildApp({
      db: createTestDb(),
      internalToken: TOKEN,
      tools: [{ id: 'pr_reviewer', baseUrl: service.baseUrl }],
      healthTimeoutMs: 500,
      proxyTimeoutMs: 2000,
      logger: { level: 'silent' },
    });
    await listenLocal(gateway, 0);
    gatewayUrl = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await gateway.close();
    await service.app.close();
  });

  it('usa el mismo encabezado que contracts', () => {
    expect(CLIENT_HEADER.toLowerCase()).toBe(MCP_CLIENT_HEADER);
    expect(CLIENT_VALUE).toBe(MCP_CLIENT_VALUE);
  });

  it('lista las herramientas y los prompts del gateway', async () => {
    const { client } = await connect(gatewayUrl);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['pr_reviewer_get_pr', 'pr_reviewer_save_draft']);
    expect(tools[0]?.inputSchema).toMatchObject({ type: 'object' });
    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
    expect(tools[1]?.annotations?.readOnlyHint).toBe(false);

    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(['pr_reviewer_review']);
    const prompt = await client.getPrompt({ name: 'pr_reviewer_review', arguments: { pr: '42' } });
    expect(prompt.messages[0]?.content).toMatchObject({ type: 'text', text: 'Revisá el PR 42.' });
    await client.close();
  });

  it('llama a una herramienta y recibe el resultado', async () => {
    const { client } = await connect(gatewayUrl);
    const result = await client.callTool({
      name: 'pr_reviewer_get_pr',
      arguments: { text: 'hola' },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe('PR: hola');
    const draft = await client.callTool({
      name: 'pr_reviewer_save_draft',
      arguments: { text: 'a' },
    });
    expect(textOf(draft)).toBe('{"saved":true}');
    await client.close();
  });

  it('devuelve el error del gateway como resultado de la herramienta', async () => {
    const { client } = await connect(gatewayUrl);
    const result = await client.callTool({ name: 'pr_reviewer_nada', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/no existe/);
    await client.close();
  });

  describe('con el gateway caído', () => {
    let deadUrl: string;
    beforeEach(async () => {
      await gateway.close();
      deadUrl = gatewayUrl;
    });

    it('listar herramientas falla con un error claro, sin colgarse', async () => {
      const logs: string[] = [];
      const { client } = await connect(deadUrl, (m) => logs.push(m));
      await expect(client.listTools()).rejects.toThrow(/gateway de Atalaya.*¿Está corriendo\?/);
      await expect(client.listPrompts()).rejects.toThrow(/gateway de Atalaya/);
      expect(logs.join('')).not.toContain(TOKEN);
      await client.close();
    });

    it('llamar a una herramienta devuelve un resultado de error que lo explica', async () => {
      const { client } = await connect(deadUrl);
      const result = await client.callTool({ name: 'pr_reviewer_get_pr', arguments: {} });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toMatch(/gateway de Atalaya.*¿Está corriendo\?/);
      await client.close();
    });

    it('no se cuelga si el gateway acepta la conexión y no responde', async () => {
      const { createServer } = await import('node:net');
      const silent = createServer(() => undefined);
      await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${(silent.address() as AddressInfo).port}`;
      const { client } = await connect(url);
      await expect(client.listTools()).rejects.toThrow(/gateway de Atalaya/);
      await client.close();
      silent.close();
    });
  });
});
