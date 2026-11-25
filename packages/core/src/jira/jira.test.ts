import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/errors.js';
import { checkJiraProject } from './check.js';
import { createJiraProvider, type JiraFetch } from './client.js';

const TOKEN = 'jira_token_SECRETO_DE_PRUEBA_123456';
const EMAIL = 'persona@ejemplo.test';
const BASE = 'https://ejemplo.atlassian.net';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const provider = (fetchFn: JiraFetch) =>
  createJiraProvider({ baseUrl: BASE, email: EMAIL, apiToken: TOKEN, fetchFn });

async function errorOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
  }
  throw new Error('se esperaba un AppError');
}

describe('createJiraProvider', () => {
  it('pide el proyecto con autenticación Basic y devuelve key y name', async () => {
    const fetchFn = vi
      .fn<JiraFetch>()
      .mockResolvedValue(json(200, { key: 'DEMO', name: 'Proyecto demo', id: '1', self: 'x' }));
    await expect(provider(fetchFn).getProject('DEMO')).resolves.toEqual({
      key: 'DEMO',
      name: 'Proyecto demo',
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${BASE}/rest/api/3/project/DEMO`);
    expect(init.redirect).toBe('error');
    const auth = (init.headers as Record<string, string>).Authorization!;
    expect(Buffer.from(auth.replace('Basic ', ''), 'base64').toString()).toBe(`${EMAIL}:${TOKEN}`);
  });

  it.each([
    [401, 'JIRA_AUTH', 502],
    [404, 'JIRA_PROJECT_NOT_FOUND', 404],
    [403, 'JIRA_PROJECT_NOT_FOUND', 404],
    [500, 'JIRA_UNAVAILABLE', 502],
    [429, 'JIRA_UNAVAILABLE', 502],
  ])('traduce el estado %i a %s', async (status, code, httpStatus) => {
    const fetchFn = vi.fn<JiraFetch>().mockResolvedValue(json(status, { message: TOKEN }));
    const error = await errorOf(provider(fetchFn).getProject('DEMO'));
    expect(error.code).toBe(code);
    expect(error.status).toBe(httpStatus);
    expect(error.message).not.toContain(TOKEN);
  });

  it('traduce un error de red sin copiar su mensaje', async () => {
    const fetchFn = vi.fn<JiraFetch>().mockRejectedValue(new Error(TOKEN));
    const error = await errorOf(provider(fetchFn).getProject('DEMO'));
    expect(error.code).toBe('JIRA_UNAVAILABLE');
    expect(error.message).not.toContain(TOKEN);
  });

  it('rechaza una respuesta con formato inesperado', async () => {
    const fetchFn = vi.fn<JiraFetch>().mockResolvedValue(json(200, { otra: 'cosa' }));
    expect((await errorOf(provider(fetchFn).getProject('DEMO'))).code).toBe('JIRA_UNAVAILABLE');
  });

  it('no llama a Jira con una key de formato inválido', async () => {
    const fetchFn = vi.fn<JiraFetch>();
    const error = await errorOf(provider(fetchFn).getProject('../x'));
    expect(error.code).toBe('JIRA_PROJECT_NOT_FOUND');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rechaza credenciales vacías', () => {
    expect(() => createJiraProvider({ baseUrl: BASE, email: '', apiToken: TOKEN })).toThrow();
  });
});

describe('checkJiraProject', () => {
  it('arma el resultado con el nombre del proyecto', async () => {
    const jira = { getProject: vi.fn().mockResolvedValue({ key: 'DEMO', name: 'Proyecto demo' }) };
    await expect(checkJiraProject(jira, 'DEMO')).resolves.toMatchObject({
      ok: true,
      projectKey: 'DEMO',
      projectName: 'Proyecto demo',
    });
  });
});
