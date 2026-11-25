import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ToolEntry } from '../tools.config.js';
import { callTool, type Upstream } from '../upstream.js';

const manifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
});
export type ToolManifest = z.infer<typeof manifestSchema>;

/** Lee el manifiesto de una herramienta; `null` si no responde o responde algo inválido. */
export async function fetchManifest(
  upstream: Upstream,
  tool: ToolEntry,
  timeoutMs: number,
): Promise<ToolManifest | null> {
  try {
    const res = await callTool(upstream, tool, '/internal/manifest', { timeoutMs });
    if (!res.ok) return null;
    const parsed = manifestSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function isHealthy(upstream: Upstream, tool: ToolEntry, timeoutMs: number) {
  try {
    const res = await callTool(upstream, tool, '/internal/health', { timeoutMs });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return z.object({ ok: z.literal(true) }).safeParse(body).success;
  } catch {
    return false;
  }
}

export interface HealthRoutesOptions {
  upstream: Upstream;
  tools: ToolEntry[];
  healthTimeoutMs: number;
  githubConfigured: boolean;
}

/** `GET /health` (salud agregada) y `GET /tools` (manifiestos). Nunca falla por una herramienta caída. */
export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  const { upstream, tools, healthTimeoutMs, githubConfigured } = options;

  app.get('/health', async () => {
    const statuses = await Promise.all(
      tools.map(async (tool) => {
        const [healthy, manifest] = await Promise.all([
          isHealthy(upstream, tool, healthTimeoutMs),
          fetchManifest(upstream, tool, healthTimeoutMs),
        ]);
        const ok = healthy && manifest !== null;
        return { id: tool.id, ok, version: ok ? manifest.version : null };
      }),
    );
    return { ok: statuses.every((status) => status.ok), tools: statuses, githubConfigured };
  });

  app.get('/tools', async () => {
    const manifests = await Promise.all(
      tools.map(async (tool) => ({
        tool,
        manifest: await fetchManifest(upstream, tool, healthTimeoutMs),
      })),
    );
    return {
      tools: manifests.flatMap(({ tool, manifest }) =>
        manifest
          ? [
              {
                id: tool.id,
                name: manifest.name,
                description: manifest.description,
                version: manifest.version,
              },
            ]
          : [],
      ),
    };
  });
};
