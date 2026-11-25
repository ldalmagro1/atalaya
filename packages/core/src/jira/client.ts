import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { translateJiraStatus } from './errors.js';
import type { JiraProject, JiraProvider } from './types.js';

export type JiraFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface CreateJiraProviderOptions {
  /** `https://<sitio>.atlassian.net`, sin barra final. */
  baseUrl: string;
  email: string;
  apiToken: string;
  /** Para inyectar un cliente falso en los tests; por defecto, `fetch` de Node. */
  fetchFn?: JiraFetch;
  timeoutMs?: number;
}

const PROJECT_KEY = /^[A-Z][A-Z0-9]+$/;
const projectSchema = z.object({ key: z.string(), name: z.string() });

/**
 * Cliente de la API REST v3 de Jira con `fetch`. Es el único lugar que construye URLs de la API.
 * Las credenciales solo van en la cabecera `Authorization` de cada pedido; no se copian a
 * errores ni mensajes.
 */
export function createJiraProvider(options: CreateJiraProviderOptions): JiraProvider {
  const { baseUrl, email, apiToken, fetchFn = fetch, timeoutMs = 10_000 } = options;
  if (!email || !apiToken || !baseUrl) throw new Error('Faltan credenciales de Jira');
  const authorization = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;

  return {
    async getProject(key: string): Promise<JiraProject> {
      if (!PROJECT_KEY.test(key)) throw translateJiraStatus(404, key);
      let res: Response;
      try {
        res = await fetchFn(`${baseUrl}/rest/api/3/project/${encodeURIComponent(key)}`, {
          headers: { Authorization: authorization, Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw translateJiraStatus(null, key);
      }
      if (!res.ok) throw translateJiraStatus(res.status, key);
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw translateJiraStatus(null, key);
      }
      const parsed = projectSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError('JIRA_UNAVAILABLE', 'Jira respondió con un formato inesperado.', 502);
      }
      return { key: parsed.data.key, name: parsed.data.name };
    },
  };
}
