import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { createServiceApp, listenLocal, toolInputSchema } from '@atalaya/core';
import { z } from 'zod';

export const TOKEN = 'tok-' + 'a1b2c3d4'.repeat(5);

export interface McpTestService {
  app: FastifyInstance;
  baseUrl: string;
  /** Argumentos con los que se llamó a cada herramienta. */
  calls: { name: string; args: Record<string, unknown> }[];
}

/** Servicio de prueba (fábrica real de core) con una herramienta `read`, una `draft` y un prompt. */
export async function startMcpService(): Promise<McpTestService> {
  const calls: McpTestService['calls'] = [];
  const echoInput = z.object({ text: z.string() });
  const app = createServiceApp({
    id: 'pr_reviewer',
    name: 'Revisor de prueba',
    description: 'Servicio falso para los tests.',
    version: '1.2.3',
    internalToken: TOKEN,
    logger: { level: 'silent' },
    mcp: {
      tools: [
        {
          name: 'get_pr',
          description: 'Lee un PR.',
          inputSchema: toolInputSchema(echoInput),
          access: 'read',
          handler: (args) => {
            calls.push({ name: 'get_pr', args });
            return `PR: ${echoInput.parse(args).text}`;
          },
        },
        {
          name: 'save_draft',
          description: 'Guarda un borrador.',
          inputSchema: toolInputSchema(echoInput),
          access: 'draft',
          handler: (args) => {
            calls.push({ name: 'save_draft', args });
            return { saved: true };
          },
        },
      ],
      prompts: [
        {
          name: 'review',
          description: 'Instrucciones de revisión.',
          arguments: [{ name: 'pr', description: 'Número del PR', required: true }],
          text: 'Revisá el PR {{pr}}.',
        },
      ],
    },
  });
  await listenLocal(app, 0);
  const { port } = app.server.address() as AddressInfo;
  return { app, baseUrl: `http://127.0.0.1:${port}`, calls };
}
