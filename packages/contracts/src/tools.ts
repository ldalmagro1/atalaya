import { z } from 'zod';
import { Repo, ToolConfig, ToolId } from './repoConfig.js';

/** Respuesta de `GET /internal/manifest` de cada servicio. */
export const ToolManifest = z.object({
  /** Coincide con el id del registro del gateway, p. ej. `pr_reviewer`. */
  id: ToolId,
  /** Nombre visible. */
  name: z.string(),
  description: z.string(),
  version: z.string(),
  /** Configuración de un repo que todavía no tiene sección para la herramienta. */
  defaultSettings: z.record(z.string(), z.unknown()),
});
export type ToolManifest = z.infer<typeof ToolManifest>;

/** Body de `POST /internal/settings/validate`. */
export const ValidateSettingsBody = z.object({ settings: z.record(z.string(), z.unknown()) });
export type ValidateSettingsBody = z.infer<typeof ValidateSettingsBody>;

/** Un error de validación; `path` usa puntos (`''` si es del objeto entero). */
export const SettingsError = z.object({ path: z.string(), message: z.string() });
export type SettingsError = z.infer<typeof SettingsError>;

/** Respuesta de `POST /internal/settings/validate`; `settings` son los valores normalizados. */
export const SettingsValidationResult = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), settings: z.record(z.string(), z.unknown()) }),
  z.object({ ok: z.literal(false), errors: z.array(SettingsError) }),
]);
export type SettingsValidationResult = z.infer<typeof SettingsValidationResult>;

/** Error 400 de `PUT /api/repos/:id/tools/:toolId` con el detalle que devuelve el servicio. */
export const InvalidSettingsResponse = z.object({
  code: z.literal('INVALID_SETTINGS'),
  message: z.string(),
  errors: z.array(SettingsError),
});
export type InvalidSettingsResponse = z.infer<typeof InvalidSettingsResponse>;

/** Sección resuelta de una herramienta registrada. */
export const ResolvedToolConfig = ToolConfig.extend({
  /** Presente solo si el servicio de la herramienta no responde. */
  unavailable: z.literal(true).optional(),
});
export type ResolvedToolConfig = z.infer<typeof ResolvedToolConfig>;

/** Respuesta de `GET /api/repos/:id`. */
export const RepoDetail = Repo.extend({
  toolsResolved: z.record(ToolId, ResolvedToolConfig),
});
export type RepoDetail = z.infer<typeof RepoDetail>;
