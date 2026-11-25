import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '@atalaya/core';
import { ToolConfig, ToolId, type InvalidSettingsResponse } from '@atalaya/contracts';
import type { RepoStore } from '../repos/repo-store.js';
import { validateSettings } from '../tool-service.js';
import type { ToolEntry } from '../tools.config.js';
import type { Upstream } from '../upstream.js';
import { repoNotFound } from './repos.js';

export interface RepoToolRoutesOptions {
  store: RepoStore;
  upstream: Upstream;
  tools: ToolEntry[];
  validateTimeoutMs: number;
}

const Params = z.object({ id: z.coerce.number().int().positive(), toolId: ToolId });

/** `PUT /repos/:id/tools/:toolId`: única ruta que escribe la sección de una herramienta. */
export const repoToolRoutes: FastifyPluginAsync<RepoToolRoutesOptions> = async (app, options) => {
  const { store, upstream, tools, validateTimeoutMs } = options;

  app.put('/repos/:id/tools/:toolId', async (request, reply) => {
    const { id, toolId } = Params.parse(request.params);
    const tool = tools.find((entry) => entry.id === toolId);
    if (!tool) {
      throw new AppError('TOOL_NOT_FOUND', `No existe la herramienta «${toolId}».`, 404);
    }
    const { enabled, settings } = ToolConfig.parse(request.body);
    if (!store.get(id)) throw repoNotFound(id);

    const result = await validateSettings(upstream, tool, settings, validateTimeoutMs);
    if (!result.ok) {
      const body: InvalidSettingsResponse = {
        code: 'INVALID_SETTINGS',
        message: `La configuración de «${toolId}» no es válida.`,
        errors: result.errors,
      };
      return reply.code(400).send(body);
    }

    // Se relee después de esperar al servicio, para no pisar cambios hechos mientras tanto.
    const repo = store.get(id);
    if (!repo) throw repoNotFound(id);
    return store.updateConfig(id, {
      ...repo.config,
      tools: { ...repo.config.tools, [toolId]: { enabled, settings: result.settings } },
    });
  });
};
