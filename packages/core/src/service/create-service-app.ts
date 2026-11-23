import { createHash, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandling } from '../lib/errors.js';

export const INTERNAL_TOKEN_HEADER = 'x-atalaya-internal-token';

export interface ServiceManifest {
  id: string;
  name: string;
  description: string;
  version: string;
}

export interface CreateServiceAppOptions extends ServiceManifest {
  internalToken: string;
  /** Opcional: nivel de log y destino (los tests capturan los logs con `stream`). */
  logger?: { level?: string; stream?: { write(message: string): void } };
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Comparación en tiempo constante: se comparan los hashes, que siempre miden lo mismo. */
function tokenMatches(received: unknown, expected: Buffer): boolean {
  if (typeof received !== 'string') return false;
  return timingSafeEqual(digest(received), expected);
}

/**
 * Crea la app Fastify base de un servicio de herramienta (ADR-001): sin CORS, protegida
 * por el token interno, con `health` y `manifest`, y sin token ni credenciales en los logs.
 */
export function createServiceApp(options: CreateServiceAppOptions): FastifyInstance {
  const { internalToken, logger, ...manifest } = options;
  if (internalToken.length === 0) throw new Error('internalToken no puede estar vacío');
  const expected = digest(internalToken);

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

  app.addHook('onRequest', async (request, reply) => {
    if (!tokenMatches(request.headers[INTERNAL_TOKEN_HEADER], expected)) {
      return reply.code(401).send({
        code: 'INVALID_INTERNAL_TOKEN',
        message: 'Falta el token interno o es incorrecto.',
      });
    }
    return undefined;
  });

  app.get('/internal/health', async () => ({ ok: true }));
  app.get('/internal/manifest', async () => ({
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
  }));

  return app;
}
