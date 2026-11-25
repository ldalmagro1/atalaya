import type { RepoConfig, RepoDetail, ResolvedToolConfig } from '@atalaya/contracts';
import { fetchManifest } from '../tool-service.js';
import type { ToolEntry } from '../tools.config.js';
import type { Upstream } from '../upstream.js';

/**
 * Configuración efectiva de cada herramienta registrada: la sección guardada tal cual o, si no
 * hay, deshabilitada con los `defaultSettings` del servicio. Si el servicio no responde, queda
 * lo guardado (o `{}`) marcado como `unavailable`.
 */
export async function resolveTools(
  upstream: Upstream,
  tools: ToolEntry[],
  config: RepoConfig,
  timeoutMs: number,
): Promise<RepoDetail['toolsResolved']> {
  const entries = await Promise.all(
    tools.map(async (tool): Promise<[string, ResolvedToolConfig]> => {
      const manifest = await fetchManifest(upstream, tool, timeoutMs);
      const section = config.tools[tool.id] ?? {
        enabled: false,
        settings: manifest?.defaultSettings ?? {},
      };
      return [tool.id, manifest ? section : { ...section, unavailable: true }];
    }),
  );
  return Object.fromEntries(entries);
}
