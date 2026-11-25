import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { createServiceApp } from './create-service-app.js';
import { parseServiceMcp, toolInputSchema } from './mcp.js';

const TOKEN = 'token-de-prueba-super-secreto-1234567890';
const HEADER = { 'x-atalaya-internal-token': TOKEN };
const base = { id: 'demo', name: 'Demo', description: 'd', version: '1', internalToken: TOKEN };

describe('MCP de la fábrica de servicio', () => {
  it('GET /internal/mcp devuelve listas vacías por omisión y exige el token', async () => {
    const app = createServiceApp({ ...base, logger: { level: 'silent' } });
    const sin = await app.inject({ method: 'GET', url: '/internal/mcp' });
    expect(sin.statusCode).toBe(401);
    const res = await app.inject({ method: 'GET', url: '/internal/mcp', headers: HEADER });
    expect(res.json()).toEqual({ tools: [], prompts: [] });
    await app.close();
  });

  it('declara las herramientas sin exponer el manejador y lo ejecuta por la ruta interna', async () => {
    const input = z.object({ n: z.number() });
    const app = createServiceApp({
      ...base,
      logger: { level: 'silent' },
      mcp: {
        tools: [
          {
            name: 'doble',
            description: 'Duplica',
            inputSchema: toolInputSchema(input),
            access: 'read',
            handler: (args) => input.parse(args).n * 2,
          },
        ],
      },
    });
    const res = await app.inject({ method: 'GET', url: '/internal/mcp', headers: HEADER });
    expect(res.json().tools).toEqual([
      {
        name: 'doble',
        description: 'Duplica',
        access: 'read',
        inputSchema: expect.objectContaining({ type: 'object' }),
      },
    ]);
    const call = await app.inject({
      method: 'POST',
      url: '/internal/mcp/tools/doble',
      headers: HEADER,
      payload: { arguments: { n: 4 } },
    });
    expect(call.json()).toEqual({ result: 8 });
    const missing = await app.inject({
      method: 'POST',
      url: '/internal/mcp/tools/nada',
      headers: HEADER,
      payload: {},
    });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("una herramienta con access 'write' hace fallar el registro", () => {
    expect(() =>
      createServiceApp({
        ...base,
        mcp: { tools: [{ name: 'publicar', description: 'p', inputSchema: {}, access: 'write' }] },
      }),
    ).toThrow(/solo pueden ser 'read' o 'draft'/);
  });

  it('rechaza nombres repetidos y nombres inválidos', () => {
    const tool = { name: 'a', description: 'd', inputSchema: {}, access: 'read' };
    expect(() => parseServiceMcp({ tools: [tool, tool], prompts: [] })).toThrow(/repetido/);
    expect(() =>
      parseServiceMcp({ tools: [{ ...tool, name: 'Mal-Nombre' }], prompts: [] }),
    ).toThrow(/inválida/);
  });

  it('toolInputSchema genera JSON Schema sin la clave $schema', () => {
    const schema = toolInputSchema(z.object({ x: z.string() }));
    expect(schema).toMatchObject({ type: 'object', required: ['x'] });
    expect(schema).not.toHaveProperty('$schema');
  });
});
