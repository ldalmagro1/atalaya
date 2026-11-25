import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** Raíz del repositorio: `gateway/src` → `..` → `..`. */
export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const port = z.coerce.number().int().min(1).max(65535);

const schema = z.object({
  GATEWAY_PORT: port.default(3001),
  INTERNAL_TOKEN: z
    .string({ error: 'es obligatorio' })
    .min(32, 'debe tener al menos 32 caracteres'),
  DB_PATH: z.string().min(1).default('./data/atalaya.db'),
  PR_REVIEWER_PORT: port.default(3101),
  /** Opcional: sin token, el gateway arranca y las rutas de GitHub lo informan. */
  GITHUB_TOKEN: z.string().optional(),
});

export interface GatewayConfig {
  readonly port: number;
  readonly internalToken: string;
  /** Ruta absoluta; una ruta relativa en `.env` se resuelve desde la raíz del repo. */
  readonly dbPath: string;
  /** Puerto de cada herramienta registrada, por id. */
  readonly toolPorts: Readonly<Record<string, number>>;
  /** Token de GitHub (fine-grained PAT) o `null` si no está configurado. Nunca se registra. */
  readonly githubToken: string | null;
}

/**
 * Lee y valida una sola vez solo las variables del gateway y devuelve un objeto inmutable.
 * Es el único lugar del gateway que toca `process.env`. Los mensajes de error nombran las
 * variables, nunca sus valores.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración inválida del gateway (${problems})`);
  }
  const { GATEWAY_PORT, INTERNAL_TOKEN, DB_PATH, PR_REVIEWER_PORT, GITHUB_TOKEN } = result.data;
  return Object.freeze({
    port: GATEWAY_PORT,
    internalToken: INTERNAL_TOKEN,
    dbPath: resolve(REPO_ROOT, DB_PATH),
    toolPorts: Object.freeze({ pr_reviewer: PR_REVIEWER_PORT }),
    githubToken: GITHUB_TOKEN?.trim() ? GITHUB_TOKEN.trim() : null,
  });
}

/** Carga el `.env` de la raíz (si existe) sin pisar variables ya definidas en el entorno. */
export function loadEnvFile(): void {
  const file = resolve(REPO_ROOT, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
