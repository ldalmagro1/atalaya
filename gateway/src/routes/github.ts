import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError, checkRepoAccess, getAuthStatus, type GitHubApi } from '@atalaya/core';
import type { GitHubStatus, RepoCheckResult } from '@atalaya/contracts';
import type { RepoStore } from '../repos/repo-store.js';

/** Cliente de GitHub del gateway; `null` si no hay `GITHUB_TOKEN`. */
export interface GitHubOptions {
  github: GitHubApi | null;
  store: RepoStore;
}

export const githubNotConfigured = () =>
  new AppError(
    'GITHUB_NOT_CONFIGURED',
    'No hay GITHUB_TOKEN configurado: defínalo en .env y reinicie el gateway.',
    503,
  );

/** `GET /github/status` y `POST /repos/:id/github/check` (se registran bajo `/api`). */
export const githubRoutes: FastifyPluginAsync<GitHubOptions> = async (app, { github, store }) => {
  app.get('/github/status', async (): Promise<GitHubStatus> => {
    if (!github) return { configured: false, valid: false, login: null };
    return { configured: true, ...(await getAuthStatus(github)) };
  });

  app.post('/repos/:id/github/check', async (request): Promise<RepoCheckResult> => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    if (!github) throw githubNotConfigured();
    const repo = store.get(id);
    if (!repo) throw new AppError('REPO_NOT_FOUND', `No existe el repositorio ${id}.`, 404);

    const result = await checkRepoAccess(github, repo.owner, repo.name);
    // Se relee después de esperar a GitHub, para no pisar cambios hechos mientras tanto.
    const current = store.get(id);
    if (current) {
      store.updateConfig(id, {
        ...current.config,
        github: { ...current.config.github, defaultBranch: result.defaultBranch },
      });
    }
    return result;
  });
};
