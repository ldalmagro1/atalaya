import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '@atalaya/core';
import { TOOL_ID_PATTERN, type ToolEntry } from '../tools.config.js';
import { callTool, type Upstream } from '../upstream.js';

/** Cabeceras del navegador que se reenvían al servicio. Cookie y Authorization nunca. */
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language'] as const;
/** Cabeceras de la respuesta del servicio que se devuelven al navegador. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag'] as const;

const paramsSchema = z.object({
  toolId: z.string().regex(TOOL_ID_PATTERN, 'id de herramienta inválido'),
  '*': z.string(),
});

/** Rechaza `.`/`..` y las rutas internas del servicio, que el gateway no expone. */
function isForbiddenPath(rest: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    return true;
  }
  const segments = decoded.split('/');
  return segments.some((s) => s === '.' || s === '..') || segments[0] === 'internal';
}

export interface ProxyRoutesOptions {
  upstream: Upstream;
  tools: ToolEntry[];
  proxyTimeoutMs: number;
}

/** `ALL /tools/:toolId/*`: reenvía al servicio la ruta restante con el token interno. */
export const proxyRoutes: FastifyPluginAsync<ProxyRoutesOptions> = async (app, options) => {
  const { upstream, tools, proxyTimeoutMs } = options;

  // El cuerpo se reenvía tal cual llegó, sea del tipo que sea.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.all('/tools/:toolId/*', async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const tool = tools.find((candidate) => candidate.id === params.toolId);
    if (!tool) {
      throw new AppError('TOOL_NOT_FOUND', `La herramienta «${params.toolId}» no existe.`, 404);
    }
    if (isForbiddenPath(params['*'])) {
      throw new AppError('NOT_FOUND', 'Ruta inexistente.', 404);
    }

    const queryIndex = request.url.indexOf('?');
    const search = queryIndex === -1 ? '' : request.url.slice(queryIndex);
    const headers: Record<string, string> = {};
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }
    const body =
      Buffer.isBuffer(request.body) && request.body.length > 0 ? request.body : undefined;

    let response: Response;
    let payload: Buffer;
    try {
      response = await callTool(upstream, tool, `/${params['*']}${search}`, {
        method: request.method,
        headers,
        timeoutMs: proxyTimeoutMs,
        ...(body ? { body } : {}),
      });
      payload = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      request.log.warn(
        { tool: tool.id, reason: error instanceof Error ? error.name : 'unknown' },
        'Herramienta no disponible',
      );
      throw new AppError('TOOL_UNAVAILABLE', `La herramienta «${tool.id}» no responde.`, 502);
    }

    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) reply.header(name, value);
    }
    return reply.code(response.status).send(payload);
  });
};
