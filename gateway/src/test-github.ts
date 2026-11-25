import type { GitHubApi } from '@atalaya/core';

type Overrides = { [K in keyof GitHubApi]?: Partial<GitHubApi[K]> };

/** Cliente de GitHub falso (sin red) en el que todo repositorio existe. Datos inventados. */
export function fakeGitHub(overrides: Overrides = {}): GitHubApi {
  return {
    users: {
      getAuthenticated: async () => ({ data: { login: 'lucas' } }),
      ...overrides.users,
    },
    repos: {
      get: async ({ owner, repo }) => ({
        data: { default_branch: 'develop', html_url: `https://github.com/${owner}/${repo}` },
      }),
      getContent: async () => ({ data: [] }),
      ...overrides.repos,
    },
    pulls: {
      list: async () => ({ data: [] }),
      get: async () => ({ data: {} }),
      listFiles: async () => ({ data: [] }),
      createReview: async () => ({ data: {} }),
      ...overrides.pulls,
    },
  };
}
