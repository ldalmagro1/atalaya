import type { z } from 'zod';
import type { SettingsValidationResult } from '@atalaya/contracts';

export type Settings = Record<string, unknown>;

/** Valida los `settings` de una herramienta; cada servicio es dueño de su schema. */
export type SettingsValidator = (
  settings: Settings,
) => SettingsValidationResult | Promise<SettingsValidationResult>;

/** Validador a partir de un schema de zod: devuelve los valores normalizados o los errores. */
export function settingsValidator(schema: z.ZodType<Settings>): SettingsValidator {
  return (settings) => {
    const result = schema.safeParse(settings);
    if (result.success) return { ok: true, settings: result.data };
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  };
}

/** Validador de un servicio que no declara settings: solo admite el objeto vacío. */
export const noSettingsValidator: SettingsValidator = (settings) => {
  const keys = Object.keys(settings);
  if (keys.length === 0) return { ok: true, settings: {} };
  return {
    ok: false,
    errors: keys.map((path) => ({ path, message: 'Esta herramienta no admite configuración.' })),
  };
};
