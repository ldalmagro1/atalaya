import { z } from 'zod';

/** Id de herramienta: minúsculas, números y guion bajo (igual que en el gateway). */
export const ToolId = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** Sección de una herramienta. El contenido de `settings` lo valida el servicio de esa herramienta. */
export const ToolConfig = z.object({
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
});
export type ToolConfig = z.infer<typeof ToolConfig>;

/** Configuración de un repositorio, con una sección por herramienta en `tools`. */
export const RepoConfig = z.object({
  version: z.literal(1),
  github: z.object({ defaultBranch: z.string().nullable() }),
  jira: z.object({ projectKey: z.string().regex(/^[A-Z][A-Z0-9]+$/) }).nullable(),
  tools: z.record(ToolId, ToolConfig),
});
export type RepoConfig = z.infer<typeof RepoConfig>;

/** Configuración de un repo recién dado de alta. */
export function defaultRepoConfig(): RepoConfig {
  return { version: 1, github: { defaultBranch: null }, jira: null, tools: {} };
}

/** Dueño en GitHub: letras, números y guiones, hasta 39 caracteres. */
export const RepoOwner = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/);

/** Nombre de repo en GitHub: letras, números, `.`, `_` y `-`, hasta 100; sin `.` ni `..`. */
export const RepoName = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,100}$/)
  .refine((name) => name !== '.' && name !== '..');

/** Body de `POST /api/repos`. */
export const CreateRepoBody = z.object({ owner: RepoOwner, name: RepoName });
export type CreateRepoBody = z.infer<typeof CreateRepoBody>;

/** Repo con su configuración parseada (detalle, lista y ruta interna). */
export const Repo = z.object({
  id: z.number().int().positive(),
  owner: z.string(),
  name: z.string(),
  config: RepoConfig,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Repo = z.infer<typeof Repo>;

/** Respuesta de `GET /api/repos`. */
export const RepoListResponse = z.object({ repos: z.array(Repo) });
export type RepoListResponse = z.infer<typeof RepoListResponse>;
