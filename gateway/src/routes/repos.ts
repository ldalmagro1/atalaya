import { isDeepStrictEqual } from 'node:util';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError, requireInternalToken } from '@atalaya/core';
import {
  CreateRepoBody,
  RepoConfig,
  RepoName,
  RepoOwner,
  type RepoDetail,
} from '@atalaya/contracts';
import type { RepoStore } from '../repos/repo-store.js';
import { resolveTools } from '../repos/resolve-tools.js';
import type { ToolEntry } from '../tools.config.js';
import type { Upstream } from '../upstream.js';

const IdParams = z.object({ id: z.coerce.number().int().positive() });

export const repoNotFound = (id: number) =>
  new AppError('REPO_NOT_FOUND', `No existe el repositorio ${id}.`, 404);

export interface RepoRoutesOptions {
  store: RepoStore;
  upstream: Upstream;
  tools: ToolEntry[];
  manifestTimeoutMs: number;
}

/** CRUD de repositorios para la web: `/repos` (se registra bajo `/api`). */
export const repoRoutes: FastifyPluginAsync<RepoRoutesOptions> = async (app, options) => {
  const { store, upstream, tools, manifestTimeoutMs } = options;

  app.get('/repos', async () => ({ repos: store.list() }));

  app.post('/repos', async (request, reply) => {
    const { owner, name } = CreateRepoBody.parse(request.body);
    return reply.code(201).send(store.create(owner, name));
  });

  app.get('/repos/:id', async (request): Promise<RepoDetail> => {
    const { id } = IdParams.parse(request.params);
    const repo = store.get(id);
    if (!repo) throw repoNotFound(id);
    const toolsResolved = await resolveTools(upstream, tools, repo.config, manifestTimeoutMs);
    return { ...repo, toolsResolved };
  });

  app.put('/repos/:id/config', async (request) => {
    const { id } = IdParams.parse(request.params);
    const config = RepoConfig.parse(request.body);
    const storedTools = store.getStoredTools(id);
    if (!storedTools) throw repoNotFound(id);
    // Los settings solo entran validados por su servicio: esta ruta no los cambia.
    if (!isDeepStrictEqual(config.tools, storedTools)) {
      throw new AppError(
        'TOOLS_NOT_EDITABLE',
        `Esta ruta no cambia \`tools\`: envíe las secciones tal como están guardadas y use PUT /api/repos/${id}/tools/:toolId.`,
        400,
      );
    }
    const repo = store.updateConfig(id, config);
    if (!repo) throw repoNotFound(id);
    return repo;
  });

  app.delete('/repos/:id', async (request, reply) => {
    const { id } = IdParams.parse(request.params);
    if (!store.delete(id)) throw repoNotFound(id);
    return reply.code(204).send();
  });
};

/** Ruta interna para las herramientas: exige el token interno y no lleva CORS. */
export const internalRepoRoutes: FastifyPluginAsync<{
  store: RepoStore;
  internalToken: string;
}> = async (app, { store, internalToken }) => {
  requireInternalToken(app, internalToken);

  app.get('/internal/repos/:owner/:name', async (request) => {
    const { owner, name } = z.object({ owner: RepoOwner, name: RepoName }).parse(request.params);
    const repo = store.getByOwnerName(owner, name);
    if (!repo) {
      throw new AppError(
        'REPO_NOT_REGISTERED',
        `El repositorio ${owner}/${name} no está dado de alta en Atalaya.`,
        404,
      );
    }
    return repo;
  });
};
