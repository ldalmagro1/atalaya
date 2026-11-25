import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError, requireInternalToken } from '@atalaya/core';
import { CreateRepoBody, RepoConfig, RepoName, RepoOwner } from '@atalaya/contracts';
import type { RepoStore } from '../repos/repo-store.js';

const IdParams = z.object({ id: z.coerce.number().int().positive() });

const notFound = (id: number) =>
  new AppError('REPO_NOT_FOUND', `No existe el repositorio ${id}.`, 404);

/** CRUD de repositorios para la web: `/repos` (se registra bajo `/api`). */
export const repoRoutes: FastifyPluginAsync<{ store: RepoStore }> = async (app, { store }) => {
  app.get('/repos', async () => ({ repos: store.list() }));

  app.post('/repos', async (request, reply) => {
    const { owner, name } = CreateRepoBody.parse(request.body);
    return reply.code(201).send(store.create(owner, name));
  });

  app.get('/repos/:id', async (request) => {
    const { id } = IdParams.parse(request.params);
    const repo = store.get(id);
    if (!repo) throw notFound(id);
    return repo;
  });

  app.put('/repos/:id/config', async (request) => {
    const { id } = IdParams.parse(request.params);
    const config = RepoConfig.parse(request.body);
    const repo = store.updateConfig(id, config);
    if (!repo) throw notFound(id);
    return repo;
  });

  app.delete('/repos/:id', async (request, reply) => {
    const { id } = IdParams.parse(request.params);
    if (!store.delete(id)) throw notFound(id);
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
