import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/** Error de aplicación con código estable, mensaje y estado HTTP. */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export interface ErrorBody {
  code: string;
  message: string;
}

/**
 * Registra el manejador uniforme de errores: toda respuesta de error tiene forma
 * `{ code, message }`. Los errores no previstos no filtran detalles internos.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    const body: ErrorBody = { code: 'NOT_FOUND', message: 'Ruta inexistente.' };
    return reply.code(404).send(body);
  });

  app.setErrorHandler((error: FastifyError | AppError | ZodError, request, reply) => {
    if (error instanceof AppError) {
      const body: ErrorBody = { code: error.code, message: error.message };
      return reply.code(error.status).send(body);
    }
    if (error instanceof ZodError) {
      const body: ErrorBody = {
        code: 'VALIDATION_ERROR',
        message: error.issues
          .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
          .join('; '),
      };
      return reply.code(400).send(body);
    }
    const status = 'statusCode' in error ? error.statusCode : undefined;
    if (status !== undefined && status >= 400 && status < 500) {
      const body: ErrorBody = { code: 'BAD_REQUEST', message: error.message };
      return reply.code(status).send(body);
    }
    request.log.error({ err: error }, 'Error no controlado');
    const body: ErrorBody = { code: 'INTERNAL_ERROR', message: 'Error interno.' };
    return reply.code(500).send(body);
  });
}
