import { AppError } from '@atalaya/core';
import { SettingsValidationResult, ToolManifest } from '@atalaya/contracts';
import type { ToolEntry } from './tools.config.js';
import { callTool, type Upstream } from './upstream.js';

/** Lee el manifiesto de una herramienta; `null` si no responde o responde algo inválido. */
export async function fetchManifest(
  upstream: Upstream,
  tool: ToolEntry,
  timeoutMs: number,
): Promise<ToolManifest | null> {
  try {
    const res = await callTool(upstream, tool, '/internal/manifest', { timeoutMs });
    if (!res.ok) return null;
    const parsed = ToolManifest.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Pide al servicio que valide los settings. Si no responde o responde algo inesperado,
 * 502 `TOOL_UNAVAILABLE`: nunca se dan por válidos sin su confirmación.
 */
export async function validateSettings(
  upstream: Upstream,
  tool: ToolEntry,
  settings: Record<string, unknown>,
  timeoutMs: number,
): Promise<SettingsValidationResult> {
  try {
    const res = await callTool(upstream, tool, '/internal/settings/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify({ settings })),
      timeoutMs,
    });
    if (res.ok) return SettingsValidationResult.parse(await res.json());
  } catch {
    // Servicio caído, tiempo agotado o respuesta con otra forma: mismo error.
  }
  throw new AppError(
    'TOOL_UNAVAILABLE',
    `La herramienta «${tool.id}» no pudo validar la configuración.`,
    502,
  );
}
