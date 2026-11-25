import { createHash, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { ValidateSettingsBody } from '@atalaya/contracts';
import { registerErrorHandling } from '../lib/errors.js';
import { AppError } from '../lib/errors.js';
import { parseServiceMcp, type McpToolRegistration } from './mcp.js';
import { noSettingsValidator, type Settings, type SettingsValidator } from './settings.js';

export const INTERNAL_TOKEN_HEADER = 'x-atalaya-internal-token';

export interface ServiceManifest {
  id: string;
  name: string;
  description: string;
  version: string;
}

export interface CreateServiceAppOptions extends ServiceManifest {
  internalToken: string;
  /** Settings de un repo sin sección guardada (van en el manifiesto). Por defecto, `{}`. */
  defaultSettings?: Settings;
  /** Valida y normaliza los settings. Sin esto, solo se admite `{}`. */
  validateSettings?: SettingsValidator;
  /** Herramientas y prompts MCP del servicio (`GET /internal/mcp`). Sin esto, listas vacías. */
  mcp?: { tools?: McpToolRegistration[]; prompts?: unknown[] };
  /** Opcional: nivel de log y destino (los tests capturan los logs con `stream`). */
  logger?: { level?: string; stream?: { write(message: string): void } };
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Comparación en tiempo constante: se comparan los hashes, que siempre miden lo mismo. */
function tokenMatches(received: unknown, expected: Buffer): boolean {
  if (typeof received !== 'string') return false;
  return timingSafeEqual(digest(received), expected);
}

/** Agrega a `app` (o a un contexto encapsulado) el 401 `INVALID_INTERNAL_TOKEN` sin token válido. */
export function requireInternalToken(app: FastifyInstance, internalToken: string): void {
  if (internalToken.length === 0) throw new Error('internalToken no puede estar vacío');
  const expected = digest(internalToken);
  app.addHook('onRequest', async (request, reply) => {
    if (!tokenMatches(request.headers[INTERNAL_TOKEN_HEADER], expected)) {
      return reply.code(401).send({
        code: 'INVALID_INTERNAL_TOKEN',
        message: 'Falta el token interno o es incorrecto.',
      });
    }
    return undefined;
  });
}

/**
 * Crea la app Fastify base de un servicio de herramienta (ADR-001): sin CORS, protegida
 * por el token interno, con `health`, `manifest` y la validación de settings, y sin token ni credenciales en los logs.
 */
export function createServiceApp(options: CreateServiceAppOptions): FastifyInstance {
  const {
    internalToken,
    logger,
    mcp,
    defaultSettings = {},
    validateSettings = noSettingsValidator,
    ...manifest
  } = options;
  if (internalToken.length === 0) throw new Error('internalToken no puede estar vacío');
  const mcpDeclaration = parseServiceMcp({ tools: mcp?.tools ?? [], prompts: mcp?.prompts ?? [] });
  const mcpHandlers = new Map(
    (mcp?.tools ?? []).flatMap((tool) =>
      tool.handler ? [[tool.name, tool.handler] as const] : [],
    ),
  );

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

  requireInternalToken(app, internalToken);

  app.get('/internal/health', async () => ({ ok: true }));
  app.get('/internal/mcp', async () => mcpDeclaration);
  // El gateway reenvía acá las llamadas de las herramientas MCP; el servicio valida sus argumentos.
  app.post('/internal/mcp/tools/:name', async (request) => {
    const { name } = request.params as { name: string };
    const handler = mcpHandlers.get(name);
    if (!handler) {
      throw new AppError('MCP_TOOL_NOT_FOUND', `La herramienta MCP «${name}» no existe.`, 404);
    }
    const body = request.body as { arguments?: Record<string, unknown> } | undefined;
    return { result: await handler(body?.arguments ?? {}) };
  });
  app.get('/internal/manifest', async () => ({
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    defaultSettings,
  }));
  app.post('/internal/settings/validate', async (request) => {
    const { settings } = ValidateSettingsBody.parse(request.body);
    return validateSettings(settings);
  });

  return app;
}
