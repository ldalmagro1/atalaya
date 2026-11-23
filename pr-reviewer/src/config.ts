import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** Raíz del repositorio: `pr-reviewer/src` → `..` → `..`. */
export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const schema = z.object({
  PR_REVIEWER_PORT: z.coerce.number().int().min(1).max(65535),
  INTERNAL_TOKEN: z.string().min(32, 'debe tener al menos 32 caracteres'),
  DB_PATH: z.string().min(1).default('./data/atalaya.db'),
});

export interface PrReviewerConfig {
  port: number;
  internalToken: string;
  /** Ruta absoluta; una ruta relativa en `.env` se resuelve desde la raíz del repo. */
  dbPath: string;
}

/**
 * Lee y valida una sola vez solo las variables que este servicio necesita.
 * Es el único lugar de `pr-reviewer` que toca `process.env`. Los mensajes de error
 * nombran las variables, nunca sus valores.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): PrReviewerConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración inválida de pr-reviewer (${problems})`);
  }
  const { PR_REVIEWER_PORT, INTERNAL_TOKEN, DB_PATH } = result.data;
  return {
    port: PR_REVIEWER_PORT,
    internalToken: INTERNAL_TOKEN,
    dbPath: resolve(REPO_ROOT, DB_PATH),
  };
}

/** Carga el `.env` de la raíz (si existe) sin pisar variables ya definidas en el entorno. */
export function loadEnvFile(): void {
  const file = resolve(REPO_ROOT, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
