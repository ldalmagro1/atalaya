import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandling } from '@atalaya/core';
import { healthRoutes } from './routes/health.js';
import { proxyRoutes } from './routes/proxy.js';
import type { ToolEntry } from './tools.config.js';
import { INTERNAL_TOKEN_HEADER, type FetchFn } from './upstream.js';

/** Únicos orígenes con CORS: la web en desarrollo (ADR-001). */
export const ALLOWED_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173'];

export interface BuildAppOptions {
  internalToken: string;
  tools: ToolEntry[];
  /** Para inyectar un cliente falso en los tests. */
  fetchFn?: FetchFn;
  healthTimeoutMs?: number;
  proxyTimeoutMs?: number;
  /** Nivel de log y destino (los tests capturan los logs con `stream`). */
  logger?: { level?: string; stream?: { write(message: string): void } };
}

/** Arma el gateway: CORS acotado, errores `{ code, message }`, salud, herramientas y proxy. */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { internalToken, tools, logger } = options;
  if (internalToken.length === 0) throw new Error('internalToken no puede estar vacío');
  const upstream = { fetchFn: options.fetchFn ?? fetch, internalToken };

  const app = Fastify({
    logger: {
      level: logger?.level ?? 'info',
      redact: {
        paths: [
          `req.headers["${INTERNAL_TOKEN_HEADER}"]`,
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
      ...(logger?.stream ? { stream: logger.stream } : {}),
    },
  });

  registerErrorHandling(app);
  await app.register(cors, { origin: ALLOWED_ORIGINS });

  await app.register(
    async (api) => {
      await api.register(healthRoutes, {
        upstream,
        tools,
        healthTimeoutMs: options.healthTimeoutMs ?? 1500,
      });
      await api.register(proxyRoutes, {
        upstream,
        tools,
        proxyTimeoutMs: options.proxyTimeoutMs ?? 30_000,
      });
    },
    { prefix: '/api' },
  );

  return app;
}
