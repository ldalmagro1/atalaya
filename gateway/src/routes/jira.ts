import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError, checkJiraProject, type JiraProvider } from '@atalaya/core';
import type { JiraCheckResult } from '@atalaya/contracts';
import type { RepoStore } from '../repos/repo-store.js';

/** Cliente de Jira del gateway; `null` si faltan las credenciales. */
export interface JiraOptions {
  jira: JiraProvider | null;
  store: RepoStore;
}

/** `POST /repos/:id/jira/check` (se registra bajo `/api`). No guarda nada en la config. */
export const jiraRoutes: FastifyPluginAsync<JiraOptions> = async (app, { jira, store }) => {
  app.post('/repos/:id/jira/check', async (request): Promise<JiraCheckResult> => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    if (!jira) {
      throw new AppError(
        'JIRA_NOT_CONFIGURED',
        'Faltan credenciales de Jira: defina JIRA_BASE_URL, JIRA_EMAIL y JIRA_API_TOKEN en .env y reinicie el gateway.',
        503,
      );
    }
    const repo = store.get(id);
    if (!repo) throw new AppError('REPO_NOT_FOUND', `No existe el repositorio ${id}.`, 404);
    if (!repo.config.jira) {
      throw new AppError(
        'JIRA_NOT_LINKED',
        `El repositorio ${repo.owner}/${repo.name} no tiene un proyecto de Jira vinculado.`,
        400,
      );
    }
    return checkJiraProject(jira, repo.config.jira.projectKey);
  });
};
