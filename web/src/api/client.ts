import {
  apiErrorSchema,
  healthResponseSchema,
  toolsResponseSchema,
  type ApiError,
  type HealthResponse,
  type ToolsResponse,
} from '@atalaya/contracts';
import type { ZodType } from 'zod';

/** Error de API con la forma `{ code, message }` y el estado HTTP (0 si no hubo respuesta). */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
    this.status = status;
  }
}

/** Toda la web habla solo con el gateway, por rutas relativas `/api/...` (proxy de Vite en dev). */
const API_BASE = '/api';

export async function apiGet<T>(
  path: string,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(
      { code: 'NETWORK_ERROR', message: 'No se pudo conectar con el gateway.' },
      0,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      parsedError.success
        ? parsedError.data
        : { code: 'HTTP_ERROR', message: `El gateway respondió ${response.status}.` },
      response.status,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiRequestError(
      { code: 'INVALID_RESPONSE', message: 'La respuesta del gateway no tiene la forma esperada.' },
      response.status,
    );
  }
  return parsed.data;
}

export const api = {
  health: (signal?: AbortSignal): Promise<HealthResponse> =>
    apiGet('/health', healthResponseSchema, signal),
  tools: (signal?: AbortSignal): Promise<ToolsResponse> =>
    apiGet('/tools', toolsResponseSchema, signal),
};
