import type { FastifyPluginAsync } from 'fastify';
import {
  MCP_CLIENT_HEADER,
  MCP_CLIENT_VALUE,
  apiErrorSchema,
  mcpCallBodySchema,
  type McpManifest,
  type McpPromptDef,
  type McpToolDef,
} from '@atalaya/contracts';
import { AppError, parseServiceMcp } from '@atalaya/core';
import type { ToolEntry } from '../tools.config.js';
import { callTool, type Upstream } from '../upstream.js';

export interface McpRoutesOptions {
  upstream: Upstream;
  tools: ToolEntry[];
  healthTimeoutMs: number;
  proxyTimeoutMs: number;
}

/** Lo que declara un servicio, con el id de su herramienta. `null` si no responde. */
async function fetchDeclaration(
  options: McpRoutesOptions,
  tool: ToolEntry,
  log: { warn: (obj: object, msg: string) => void },
) {
  let body: unknown;
  try {
    const res = await callTool(options.upstream, tool, '/internal/mcp', {
      timeoutMs: options.healthTimeoutMs,
    });
    if (!res.ok) throw new Error(`estado ${res.status}`);
    body = await res.json();
  } catch (error) {
    // Un servicio caído se omite: no deja a Claude sin las herramientas de los demás.
    log.warn(
      { tool: tool.id, reason: error instanceof Error ? error.name : 'unknown' },
      'Servicio sin declaración MCP',
    );
    return null;
  }
  try {
    return parseServiceMcp(body);
  } catch (error) {
    throw new AppError(
      'MCP_INVALID_DECLARATION',
      `La herramienta «${tool.id}» declara un MCP inválido: ${error instanceof Error ? error.message : 'error desconocido'}`,
      500,
    );
  }
}

/** Rutas `/mcp/*`: manifiesto agregado y reenvío de llamadas. Exigen `X-Atalaya-Client: mcp`. */
export const mcpRoutes: FastifyPluginAsync<McpRoutesOptions> = async (app, options) => {
  const { upstream, tools, proxyTimeoutMs } = options;

  app.addHook('onRequest', async (request) => {
    if (request.method === 'OPTIONS') return;
    if (request.headers[MCP_CLIENT_HEADER] !== MCP_CLIENT_VALUE) {
      throw new AppError(
        'MCP_CLIENT_REQUIRED',
        `Falta el encabezado ${MCP_CLIENT_HEADER}: ${MCP_CLIENT_VALUE}.`,
        403,
      );
    }
  });

  async function buildManifest(
    log: Parameters<typeof fetchDeclaration>[2],
  ): Promise<{ manifest: McpManifest; owners: Map<string, ToolEntry> }> {
    const declarations = await Promise.all(
      tools.map(async (tool) => ({
        tool,
        declaration: await fetchDeclaration(options, tool, log),
      })),
    );
    const manifest: McpManifest = { tools: [], prompts: [] };
    const owners = new Map<string, ToolEntry>();
    for (const { tool, declaration } of declarations) {
      if (!declaration) continue;
      for (const def of declaration.tools) {
        const name = `${tool.id}_${def.name}`;
        manifest.tools.push({ ...def, name } satisfies McpToolDef);
        owners.set(name, tool);
      }
      for (const def of declaration.prompts) {
        manifest.prompts.push({ ...def, name: `${tool.id}_${def.name}` } satisfies McpPromptDef);
      }
    }
    return { manifest, owners };
  }

  app.get('/mcp/manifest', async (request) => (await buildManifest(request.log)).manifest);

  app.post('/mcp/tools/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const body = mcpCallBodySchema.parse(request.body ?? {});
    const owner = (await buildManifest(request.log)).owners.get(name);
    if (!owner) {
      throw new AppError('MCP_TOOL_NOT_FOUND', `La herramienta MCP «${name}» no existe.`, 404);
    }
    const serviceName = name.slice(owner.id.length + 1);

    let status: number;
    let payload: unknown;
    try {
      const response = await callTool(
        upstream,
        owner,
        `/internal/mcp/tools/${encodeURIComponent(serviceName)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: Buffer.from(JSON.stringify({ arguments: body.arguments })),
          timeoutMs: proxyTimeoutMs,
        },
      );
      status = response.status;
      payload = await response.json();
    } catch (error) {
      request.log.warn(
        { tool: owner.id, reason: error instanceof Error ? error.name : 'unknown' },
        'Herramienta no disponible',
      );
      throw new AppError('TOOL_UNAVAILABLE', `La herramienta «${owner.id}» no responde.`, 502);
    }
    if (status >= 200 && status < 300) return reply.code(200).send(payload);
    // Un error del servicio con la forma `{ code, message }` se devuelve tal cual; otro, es un 502.
    const error = apiErrorSchema.safeParse(payload);
    if (error.success && status >= 400 && status < 500) return reply.code(status).send(error.data);
    throw new AppError('TOOL_UNAVAILABLE', `La herramienta «${owner.id}» falló.`, 502);
  });
};
