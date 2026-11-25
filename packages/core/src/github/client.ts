import { Octokit } from '@octokit/rest';

/**
 * Parte de la API de GitHub que usa Atalaya. Octokit la cumple; en los tests se inyecta un
 * cliente falso con esta forma.
 */
export interface GitHubApi {
  users: { getAuthenticated(): Promise<{ data: { login: string } }> };
  repos: {
    get(params: { owner: string; repo: string }): Promise<{ data: { default_branch: string } }>;
    getContent(params: { owner: string; repo: string; path: string }): Promise<unknown>;
  };
  pulls: {
    list(params: { owner: string; repo: string; per_page: number }): Promise<unknown>;
  };
}

export interface CreateGitHubClientOptions {
  token: string;
  /** Para inyectar un cliente falso en los tests; con él no se crea ninguna instancia real. */
  octokit?: GitHubApi;
}

/**
 * Única instancia de Octokit de la plataforma (nadie fuera de `packages/core/src/github/` lo
 * importa). El token solo se entrega a Octokit y no se guarda ni se expone en otro lado.
 */
export function createGitHubClient({ token, octokit }: CreateGitHubClientOptions): GitHubApi {
  if (octokit) return octokit;
  if (token.length === 0) throw new Error('El token de GitHub no puede estar vacío');
  return new Octokit({ auth: token, userAgent: 'atalaya' });
}
