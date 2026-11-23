import type { FastifyInstance } from 'fastify';

export const LOCAL_HOST = '127.0.0.1';

/** Escucha solo en 127.0.0.1 (nunca en 0.0.0.0). Devuelve la dirección. */
export function listenLocal(app: FastifyInstance, port: number): Promise<string> {
  return app.listen({ host: LOCAL_HOST, port });
}
