import { vi } from 'vitest';
import type { GitHubApi } from './client.js';

type Overrides = { [K in keyof GitHubApi]?: Partial<GitHubApi[K]> };

/** Cliente de GitHub falso para los tests de `core` (sin red). Datos inventados. */
export function fakeApi(overrides: Overrides = {}): GitHubApi {
  return {
    users: {
      getAuthenticated: vi.fn().mockResolvedValue({ data: { login: 'lucas' } }),
      ...overrides.users,
    },
    repos: {
      get: vi.fn().mockResolvedValue({
        data: { default_branch: 'main', html_url: 'https://github.com/acme/api' },
      }),
      getContent: vi.fn().mockResolvedValue({ data: [] }),
      ...overrides.repos,
    },
    pulls: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      get: vi.fn().mockResolvedValue({ data: {} }),
      listFiles: vi.fn().mockResolvedValue({ data: [] }),
      createReview: vi.fn().mockResolvedValue({
        data: { html_url: 'https://github.com/acme/api/pull/1#pullrequestreview-1' },
      }),
      ...overrides.pulls,
    },
  };
}
