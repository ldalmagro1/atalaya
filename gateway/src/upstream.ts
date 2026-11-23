import type { ToolEntry } from './tools.config.js';

export const INTERNAL_TOKEN_HEADER = 'x-atalaya-internal-token';

export type FetchFn = typeof fetch;

export interface Upstream {
  fetchFn: FetchFn;
  internalToken: string;
}

/** Pide algo al servicio con el token interno y un tiempo máximo. */
export function callTool(
  upstream: Upstream,
  tool: ToolEntry,
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: Buffer; timeoutMs: number },
): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  return upstream.fetchFn(`${tool.baseUrl}${path}`, {
    ...rest,
    headers: { ...rest.headers, [INTERNAL_TOKEN_HEADER]: upstream.internalToken },
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
}
