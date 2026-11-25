import { describe, expect, it } from 'vitest';
import { CreateRepoBody, RepoConfig, ToolConfig, ToolId, defaultRepoConfig } from './repoConfig.js';

describe('RepoConfig', () => {
  it('acepta la configuración por defecto, con tools vacío', () => {
    const config = defaultRepoConfig();
    expect(config).toEqual({
      version: 1,
      github: { defaultBranch: null },
      jira: null,
      tools: {},
    });
    expect(RepoConfig.safeParse(config).success).toBe(true);
  });

  it('acepta una clave nueva en tools sin cambiar el schema', () => {
    const config = {
      ...defaultRepoConfig(),
      tools: { story_linter: { enabled: true, settings: { regla: 1, otra: { x: [1] } } } },
    };
    expect(RepoConfig.safeParse(config).success).toBe(true);
  });

  it.each(['PROJ', 'AT', 'A1B2', 'ATAL'])('acepta projectKey %s', (projectKey) => {
    const config = { ...defaultRepoConfig(), jira: { projectKey } };
    expect(RepoConfig.safeParse(config).success).toBe(true);
  });

  it.each(['', 'A', 'atal', '1ATAL', 'AT-AL', 'AT AL', 'Atal'])(
    'rechaza projectKey "%s"',
    (projectKey) => {
      const config = { ...defaultRepoConfig(), jira: { projectKey } };
      expect(RepoConfig.safeParse(config).success).toBe(false);
    },
  );

  it.each([0, 2, '1', null])('rechaza version %j', (version) => {
    expect(RepoConfig.safeParse({ ...defaultRepoConfig(), version }).success).toBe(false);
  });

  it('rechaza una herramienta con ToolId inválido', () => {
    const config = {
      ...defaultRepoConfig(),
      tools: { 'Mala-Id': { enabled: true, settings: {} } },
    };
    expect(RepoConfig.safeParse(config).success).toBe(false);
  });

  it('rechaza settings que no sea un objeto', () => {
    expect(ToolConfig.safeParse({ enabled: true, settings: 'x' }).success).toBe(false);
    expect(ToolConfig.safeParse({ enabled: true, settings: [1] }).success).toBe(false);
    expect(ToolConfig.safeParse({ enabled: true, settings: null }).success).toBe(false);
    expect(ToolConfig.safeParse({ enabled: 'si', settings: {} }).success).toBe(false);
  });

  it('exige jira (puede ser null) y github', () => {
    expect(RepoConfig.safeParse({ ...defaultRepoConfig(), jira: undefined }).success).toBe(false);
    expect(RepoConfig.safeParse({ ...defaultRepoConfig(), github: undefined }).success).toBe(false);
  });
});

describe('ToolId', () => {
  it.each(['pr_reviewer', 'a', 'forecast2', 'sprint_map'])('acepta %s', (id) => {
    expect(ToolId.safeParse(id).success).toBe(true);
  });
  it.each(['', 'PrReviewer', '1tool', '_tool', 'pr-reviewer', 'pr reviewer', 'tool.x'])(
    'rechaza "%s"',
    (id) => {
      expect(ToolId.safeParse(id).success).toBe(false);
    },
  );
});

describe('CreateRepoBody', () => {
  it('acepta owner y name de GitHub', () => {
    expect(CreateRepoBody.safeParse({ owner: 'ldalmagro1', name: 'atalaya.v2_x-y' }).success).toBe(
      true,
    );
  });
  it.each([
    { owner: '', name: 'a' },
    { owner: '-x', name: 'a' },
    { owner: 'a/b', name: 'a' },
    { owner: 'a'.repeat(40), name: 'a' },
    { owner: 'a', name: '' },
    { owner: 'a', name: '.' },
    { owner: 'a', name: '..' },
    { owner: 'a', name: 'a/b' },
    { owner: 'a', name: 'a'.repeat(101) },
    { owner: 'a' },
  ])('rechaza %j', (body) => {
    expect(CreateRepoBody.safeParse(body).success).toBe(false);
  });
});
