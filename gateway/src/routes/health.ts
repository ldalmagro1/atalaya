import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { fetchManifest } from '../tool-service.js';
import type { ToolEntry } from '../tools.config.js';
import { callTool, type Upstream } from '../upstream.js';

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
  jiraConfigured: boolean;
}

/** `GET /health` (salud agregada) y `GET /tools` (manifiestos). Nunca falla por una herramienta caída. */
export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  const { upstream, tools, healthTimeoutMs, githubConfigured, jiraConfigured } = options;

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
    return {
      ok: statuses.every((status) => status.ok),
      tools: statuses,
      githubConfigured,
      jiraConfigured,
    };
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
        manifest ? [{ ...manifest, id: tool.id }] : [],
      ),
    };
  });
};
