import { Octokit } from '@octokit/rest';
import type { InlineComment } from './types.js';

// Alias y no `interface`: Octokit exige parámetros asignables a un objeto con índice.
type RepoParams = { owner: string; repo: string };

/** Cabeceras extra de una lectura (`if-none-match`). */
type Conditional = { headers?: Record<string, string> };

/**
 * Parte de la API de GitHub que usa Atalaya. Octokit la cumple; en los tests se inyecta un
 * cliente falso con esta forma. Las respuestas `unknown` se validan con zod al leerlas.
 */
export interface GitHubApi {
  users: { getAuthenticated(): Promise<{ data: { login: string } }> };
  repos: {
    get(params: RepoParams & Conditional): Promise<{ data: { default_branch: string } }>;
    getContent(params: RepoParams & Conditional & { path: string; ref?: string }): Promise<unknown>;
  };
  pulls: {
    list(
      params: RepoParams &
        Conditional & {
          per_page: number;
          state?: 'open';
          sort?: 'updated';
          direction?: 'desc';
        },
    ): Promise<unknown>;
    get(params: RepoParams & Conditional & { pull_number: number }): Promise<unknown>;
    listFiles(
      params: RepoParams & Conditional & { pull_number: number; per_page: number; page: number },
    ): Promise<unknown>;
    /** Solo `COMMENT`: el tipo no admite aprobar ni pedir cambios. */
    createReview(
      params: RepoParams & {
        pull_number: number;
        commit_id: string;
        body: string;
        event: 'COMMENT';
        comments: InlineComment[];
      },
    ): Promise<unknown>;
  };
}

export interface CreateGitHubClientOptions {
  token: string;
  /** Para inyectar un cliente falso en los tests; con él no se crea ninguna instancia real. */
  octokit?: GitHubApi;
  /** Para probar el cliente real sin red. */
  fetch?: typeof fetch;
}

/** Octokit registra como error todo estado ≥ 300; un 304 es la lectura normal desde la caché. */
const NOT_MODIFIED_LOG = / - 304 with id /;

/**
 * Única instancia de Octokit de la plataforma (nadie fuera de `packages/core/src/github/` lo
 * importa). El token solo se entrega a Octokit y no se guarda ni se expone en otro lado.
 */
export function createGitHubClient({
  token,
  octokit,
  fetch,
}: CreateGitHubClientOptions): GitHubApi {
  if (octokit) return octokit;
  if (token.length === 0) throw new Error('El token de GitHub no puede estar vacío');
  return new Octokit({
    auth: token,
    userAgent: 'atalaya',
    log: {
      debug: () => {},
      info: () => {},
      warn: (message: string) => console.warn(message),
      error: (message: string) => {
        if (!NOT_MODIFIED_LOG.test(message)) console.error(message);
      },
    },
    ...(fetch ? { request: { fetch } } : {}),
  });
}
