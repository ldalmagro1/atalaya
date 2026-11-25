import { z } from 'zod';

export const PROJECT_NAME = 'Atalaya';

/** Línea que imprime cada servicio placeholder al arrancar. */
export function serviceBanner(service: string): string {
  return `[${PROJECT_NAME}] ${service} (placeholder)`;
}

/** Forma de los errores de API: `{ code, message }`. */
export const apiErrorSchema = z.object({ code: z.string(), message: z.string() });
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Respuesta de `GET /api/health` del gateway (salud agregada). */
export const healthResponseSchema = z.object({
  ok: z.boolean(),
  tools: z.array(z.object({ id: z.string(), ok: z.boolean(), version: z.string().nullable() })),
  /** Hay un `GITHUB_TOKEN` configurado en el gateway (no dice si es válido). */
  githubConfigured: z.boolean(),
  /** Hay `JIRA_BASE_URL`, `JIRA_EMAIL` y `JIRA_API_TOKEN` en el gateway (no dice si son válidos). */
  jiraConfigured: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Respuesta de `GET /api/tools` del gateway (manifiestos de las herramientas que responden). */
export const toolsResponseSchema = z.object({
  tools: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      version: z.string(),
    }),
  ),
});
export type ToolsResponse = z.infer<typeof toolsResponseSchema>;

export * from './repoConfig.js';
export * from './mcp.js';
