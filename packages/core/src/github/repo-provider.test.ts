import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCoreMigrations } from '../db/core-migrations.js';
import { openDatabase, type Db } from '../db/open.js';
import { createGitHubClient, type GitHubApi } from './client.js';
import { fakeApi } from './fake-api.js';
import { GitHubRepoProvider } from './repo-provider.js';
import type { InlineComment, RepoProvider } from './types.js';

const REF = { owner: 'acme', name: 'api' };
const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);

const httpError = (status: number) =>
  Object.assign(new Error('detalle de GitHub'), { status, response: { headers: {} } });
const ok = (data: unknown, etag?: string) => ({ data, headers: etag ? { etag } : {} });
const base64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');
const fileResponse = (text: string) =>
  ok({ type: 'file', encoding: 'base64', content: base64(text) });

const rawPull = (number = 7) => ({
  number,
  title: `PR ${number}`,
  user: { login: 'ana' },
  updated_at: '2026-01-02T03:04:05Z',
  html_url: `https://github.com/acme/api/pull/${number}`,
});
const summary = (number = 7) => ({
  number,
  title: `PR ${number}`,
  author: 'ana',
  updatedAt: '2026-01-02T03:04:05Z',
  htmlUrl: `https://github.com/acme/api/pull/${number}`,
});
const rawFiles = (count: number, from = 0) =>
  Array.from({ length: count }, (_, i) => ({
    filename: `src/f${from + i}.ts`,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch: '@@ -1 +1 @@',
  }));

let db: Db;
beforeEach(() => {
  db = openDatabase({ path: ':memory:' });
  runCoreMigrations(db);
});
afterEach(() => db.close());

const keys = () =>
  db
    .prepare<[], { key: string }>('SELECT key FROM core_gh_cache ORDER BY key')
    .all()
    .map((row) => row.key);

describe('lecturas', () => {
  it('getRepo devuelve la rama por defecto y la URL', async () => {
    const api = fakeApi();
    await expect(new GitHubRepoProvider(api, db).getRepo(REF)).resolves.toEqual({
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/acme/api',
    });
    expect(api.repos.get).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', headers: {} });
  });

  it('listOpenPulls pide 50 abiertos por actualización descendente', async () => {
    const list = vi.fn().mockResolvedValue(ok([rawPull(2), { ...rawPull(1), user: null }]));
    const pulls = await new GitHubRepoProvider(fakeApi({ pulls: { list } }), db).listOpenPulls(REF);
    expect(pulls).toEqual([summary(2), { ...summary(1), author: 'ghost' }]);
    expect(list).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'api',
      state: 'open',
      sort: 'updated',
      direction: 'desc',
      per_page: 50,
      headers: {},
    });
  });

  it('getPull devuelve el detalle', async () => {
    const get = vi.fn().mockResolvedValue(
      ok({
        ...rawPull(),
        body: null,
        head: { sha: SHA, ref: 'rama' },
        base: { sha: OTHER_SHA, ref: 'main' },
      }),
    );
    await expect(
      new GitHubRepoProvider(fakeApi({ pulls: { get } }), db).getPull(REF, 7),
    ).resolves.toEqual({
      ...summary(),
      body: null,
      headSha: SHA,
      baseSha: OTHER_SHA,
      headRef: 'rama',
      baseRef: 'main',
    });
    expect(get).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', pull_number: 7, headers: {} });
  });

  it.each([
    ['404', httpError(404), 'REPO_NOT_FOUND_OR_NO_ACCESS'],
    ['401', httpError(401), 'GITHUB_AUTH'],
    ['429', httpError(429), 'GITHUB_RATE_LIMIT'],
    ['500', httpError(500), 'GITHUB_UNAVAILABLE'],
    ['304 sin caché', httpError(304), 'GITHUB_UNAVAILABLE'],
  ])('traduce el error %s', async (_name, error, code) => {
    const api = fakeApi({ repos: { get: vi.fn().mockRejectedValue(error) } });
    await expect(new GitHubRepoProvider(api, db).getRepo(REF)).rejects.toMatchObject({ code });
  });

  it('una respuesta con otra forma es GITHUB_UNAVAILABLE y no se cachea', async () => {
    const api = fakeApi({ repos: { get: vi.fn().mockResolvedValue(ok({ otra: 1 }, '"e1"')) } });
    await expect(new GitHubRepoProvider(api, db).getRepo(REF)).rejects.toMatchObject({
      code: 'GITHUB_UNAVAILABLE',
    });
    expect(keys()).toEqual([]);
  });

  it.each([
    { owner: 'a/b', name: 'x' },
    { owner: 'acme', name: '..' },
  ])('rechaza la referencia %j sin llamar a GitHub', async (ref) => {
    const api = fakeApi();
    await expect(new GitHubRepoProvider(api, db).getRepo(ref)).rejects.toThrow();
    expect(api.repos.get).not.toHaveBeenCalled();
  });
});

describe('caché con ETag', () => {
  const repo = { default_branch: 'main', html_url: 'https://github.com/acme/api' };

  it('la segunda lectura envía If-None-Match y ante un 304 devuelve lo guardado', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(ok(repo, '"e1"'))
      .mockRejectedValueOnce(httpError(304));
    const provider = new GitHubRepoProvider(fakeApi({ repos: { get } }), db);
    const first = await provider.getRepo(REF);
    await expect(provider.getRepo(REF)).resolves.toEqual(first);
    expect(get).toHaveBeenLastCalledWith({
      owner: 'acme',
      repo: 'api',
      headers: { 'if-none-match': '"e1"' },
    });
  });

  it('un 200 posterior reemplaza lo guardado y su ETag', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(ok(repo, '"e1"'))
      .mockResolvedValueOnce(ok({ ...repo, default_branch: 'dev' }, '"e2"'))
      .mockRejectedValueOnce(httpError(304));
    const provider = new GitHubRepoProvider(fakeApi({ repos: { get } }), db);
    await provider.getRepo(REF);
    await expect(provider.getRepo(REF)).resolves.toMatchObject({ defaultBranch: 'dev' });
    await expect(provider.getRepo(REF)).resolves.toMatchObject({ defaultBranch: 'dev' });
    expect(get.mock.lastCall?.[0].headers).toEqual({ 'if-none-match': '"e2"' });
  });

  it('la caché persiste entre instancias y no distingue mayúsculas en owner/name', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(ok(repo, '"e1"'))
      .mockRejectedValueOnce(httpError(304));
    const api = fakeApi({ repos: { get } });
    await new GitHubRepoProvider(api, db).getRepo(REF);
    await expect(
      new GitHubRepoProvider(api, db).getRepo({ owner: 'ACME', name: 'Api' }),
    ).resolves.toMatchObject({ defaultBranch: 'main' });
    expect(keys()).toEqual(['acme/api:repo']);
  });

  it.each(['no es json', '{"otra":1}'])(
    'una entrada corrupta (%s) se ignora y se vuelve a pedir sin If-None-Match',
    async (payload) => {
      const get = vi.fn().mockResolvedValue(ok(repo, '"e1"'));
      const provider = new GitHubRepoProvider(fakeApi({ repos: { get } }), db);
      await provider.getRepo(REF);
      db.prepare('UPDATE core_gh_cache SET payload_json = ?').run(payload);
      await expect(provider.getRepo(REF)).resolves.toMatchObject({ defaultBranch: 'main' });
      expect(get.mock.lastCall?.[0].headers).toEqual({});
    },
  );

  it('un 404 borra la entrada guardada', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(ok(repo, '"e1"'))
      .mockRejectedValueOnce(httpError(404));
    const provider = new GitHubRepoProvider(fakeApi({ repos: { get } }), db);
    await provider.getRepo(REF);
    await expect(provider.getRepo(REF)).rejects.toMatchObject({
      code: 'REPO_NOT_FOUND_OR_NO_ACCESS',
    });
    expect(keys()).toEqual([]);
  });

  it('clearCache borra solo el repo pedido, o todo sin argumento', async () => {
    const provider = new GitHubRepoProvider(fakeApi(), db);
    // `_` es un comodín en LIKE: `a_i` no debe borrar `abi`.
    for (const name of ['a_i', 'abi', 'a_i-web']) await provider.getRepo({ owner: 'acme', name });
    provider.clearCache({ owner: 'ACME', name: 'a_i' });
    expect(keys()).toEqual(['acme/a_i-web:repo', 'acme/abi:repo']);
    provider.clearCache();
    expect(keys()).toEqual([]);
  });
});

describe('listPullFiles', () => {
  /** GitHub falso con `total` archivos paginados de a 100. */
  const paged = (total: number) =>
    vi.fn(async ({ page }: { page: number }) =>
      ok(rawFiles(Math.max(0, Math.min(100, total - (page - 1) * 100)), (page - 1) * 100)),
    );

  it.each([
    [0, 0, 1],
    [99, 99, 1],
    [100, 100, 2],
    [150, 150, 2],
    [300, 300, 3],
    [450, 300, 3],
  ])('con %i archivos devuelve %i en %i pedidos', async (total, expected, calls) => {
    const listFiles = paged(total);
    const provider = new GitHubRepoProvider(fakeApi({ pulls: { listFiles } }), db);
    const files = await provider.listPullFiles(REF, 7);
    expect(files).toHaveLength(expected);
    expect(new Set(files.map((file) => file.filename)).size).toBe(expected);
    expect(listFiles).toHaveBeenCalledTimes(calls);
    expect(listFiles.mock.calls[0]?.[0]).toMatchObject({ per_page: 100, page: 1 });
  });

  it('un archivo sin patch queda en null', async () => {
    const listFiles = vi
      .fn()
      .mockResolvedValue(
        ok([{ filename: 'logo.png', status: 'added', additions: 0, deletions: 0 }]),
      );
    const provider = new GitHubRepoProvider(fakeApi({ pulls: { listFiles } }), db);
    await expect(provider.listPullFiles(REF, 7)).resolves.toEqual([
      { filename: 'logo.png', status: 'added', additions: 0, deletions: 0, patch: null },
    ]);
  });

  it('cada página usa su ETag y un 304 sigue paginando con lo guardado', async () => {
    const listFiles = vi
      .fn()
      .mockResolvedValueOnce(ok(rawFiles(100), '"p1"'))
      .mockResolvedValueOnce(ok(rawFiles(1, 100), '"p2"'))
      .mockRejectedValueOnce(httpError(304))
      .mockRejectedValueOnce(httpError(304));
    const provider = new GitHubRepoProvider(fakeApi({ pulls: { listFiles } }), db);
    const first = await provider.listPullFiles(REF, 7);
    await expect(provider.listPullFiles(REF, 7)).resolves.toEqual(first);
    expect(listFiles.mock.calls.slice(2).map(([params]) => params.headers)).toEqual([
      { 'if-none-match': '"p1"' },
      { 'if-none-match': '"p2"' },
    ]);
  });
});

describe('getFileContent', () => {
  const provider = (getContent: GitHubApi['repos']['getContent']) =>
    new GitHubRepoProvider(fakeApi({ repos: { getContent } }), db);

  it('decodifica base64 con saltos de línea y caracteres no ASCII', async () => {
    const text = 'const año = "¿qué? ✓";\n'.repeat(10);
    const wrapped = base64(text).replace(/.{60}/g, '$&\n');
    const getContent = vi
      .fn()
      .mockResolvedValue(ok({ type: 'file', encoding: 'base64', content: wrapped }));
    await expect(provider(getContent).getFileContent(REF, 'src/a.ts', SHA)).resolves.toBe(text);
    expect(getContent).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'api',
      path: 'src/a.ts',
      ref: SHA,
    });
  });

  it.each(['hola', ''])('repetido por el mismo sha (%j) no llama a GitHub', async (text) => {
    const getContent = vi.fn().mockResolvedValue(fileResponse(text));
    const repo = provider(getContent);
    await expect(repo.getFileContent(REF, 'a.txt', SHA)).resolves.toBe(text);
    await expect(repo.getFileContent(REF, 'a.txt', SHA.toUpperCase())).resolves.toBe(text);
    expect(getContent).toHaveBeenCalledTimes(1);
  });

  it('otro sha u otra ruta se piden de nuevo (la ruta distingue mayúsculas)', async () => {
    const getContent = vi.fn().mockResolvedValue(fileResponse('x'));
    const repo = provider(getContent);
    await repo.getFileContent(REF, 'a.txt', SHA);
    await repo.getFileContent(REF, 'A.txt', SHA);
    await repo.getFileContent(REF, 'a.txt', OTHER_SHA);
    expect(getContent).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['una carpeta', []],
    ['un submódulo', { type: 'submodule' }],
    ['un enlace simbólico', { type: 'symlink', target: 'x' }],
    ['un archivo de más de 1 MB', { type: 'file', encoding: 'none', content: '' }],
  ])('devuelve null para %s', async (_name, data) => {
    const getContent = vi.fn().mockResolvedValue(ok(data));
    await expect(provider(getContent).getFileContent(REF, 'x', SHA)).resolves.toBeNull();
  });

  it('un 404 es null y no se cachea', async () => {
    const getContent = vi
      .fn()
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce(fileResponse('ya está'));
    const repo = provider(getContent);
    await expect(repo.getFileContent(REF, 'x', SHA)).resolves.toBeNull();
    await expect(repo.getFileContent(REF, 'x', SHA)).resolves.toBe('ya está');
  });

  it('los demás errores se traducen', async () => {
    const getContent = vi.fn().mockRejectedValue(httpError(500));
    await expect(provider(getContent).getFileContent(REF, 'x', SHA)).rejects.toMatchObject({
      code: 'GITHUB_UNAVAILABLE',
    });
  });

  it.each([
    ['x', 'main'],
    ['x', 'abc1234'],
    ['../../user', SHA],
    ['a/./b', SHA],
    ['', SHA],
  ])('rechaza la ruta %j con el sha %j sin llamar a GitHub', async (path, sha) => {
    const getContent = vi.fn();
    await expect(provider(getContent).getFileContent(REF, path, sha)).rejects.toThrow();
    expect(getContent).not.toHaveBeenCalled();
  });
});

describe('createCommentReview', () => {
  const comment: InlineComment = { path: 'src/a.ts', line: 3, side: 'RIGHT', body: 'Revisar.' };
  const input = { commitId: SHA, body: 'Resumen.', comments: [comment] };

  it('envía event COMMENT y devuelve la URL', async () => {
    const api = fakeApi();
    const range = { ...comment, start_line: 1, start_side: 'RIGHT' as const };
    await expect(
      new GitHubRepoProvider(api, db).createCommentReview(REF, 7, {
        ...input,
        comments: [comment, range],
      }),
    ).resolves.toEqual({ htmlUrl: 'https://github.com/acme/api/pull/1#pullrequestreview-1' });
    expect(api.pulls.createReview).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'api',
      pull_number: 7,
      commit_id: SHA,
      body: 'Resumen.',
      event: 'COMMENT',
      comments: [comment, range],
    });
  });

  it('un event colado en la entrada no llega a GitHub', async () => {
    const api = fakeApi();
    const sneaky = {
      ...input,
      event: 'APPROVE',
      comments: [{ ...comment, event: 'REQUEST_CHANGES' }],
    };
    await new GitHubRepoProvider(api, db).createCommentReview(REF, 7, sneaky);
    const sent = vi.mocked(api.pulls.createReview).mock.lastCall?.[0];
    expect(sent?.event).toBe('COMMENT');
    expect(sent?.comments).toEqual([comment]);
  });

  it('rechaza un comentario del lado LEFT sin llamar a GitHub', async () => {
    const api = fakeApi();
    const bad = { ...input, comments: [{ ...comment, side: 'LEFT' }] };
    await expect(
      new GitHubRepoProvider(api, db).createCommentReview(REF, 7, bad as typeof input),
    ).rejects.toThrow();
    expect(api.pulls.createReview).not.toHaveBeenCalled();
  });

  const failing = (status: number) =>
    new GitHubRepoProvider(
      fakeApi({ pulls: { createReview: vi.fn().mockRejectedValue(httpError(status)) } }),
      db,
    );

  it('422 con comentarios en línea: INVALID_INLINE_COMMENTS', async () => {
    await expect(failing(422).createCommentReview(REF, 7, input)).rejects.toMatchObject({
      code: 'INVALID_INLINE_COMMENTS',
      status: 422,
    });
  });

  it('422 sin comentarios en línea no culpa a los comentarios', async () => {
    await expect(
      failing(422).createCommentReview(REF, 7, { ...input, comments: [] }),
    ).rejects.toMatchObject({ code: 'GITHUB_UNAVAILABLE' });
  });

  it('otro error se traduce', async () => {
    await expect(failing(401).createCommentReview(REF, 7, input)).rejects.toMatchObject({
      code: 'GITHUB_AUTH',
    });
  });

  it('nunca se cachea', async () => {
    const api = fakeApi();
    const provider = new GitHubRepoProvider(api, db);
    await provider.createCommentReview(REF, 7, input);
    await provider.createCommentReview(REF, 7, input);
    expect(api.pulls.createReview).toHaveBeenCalledTimes(2);
    expect(keys()).toEqual([]);
  });
});

describe('no hay forma de aprobar, pedir cambios ni fusionar', () => {
  it('la interfaz y la clase exponen solo estos métodos', () => {
    // Si la interfaz suma o quita un método, este objeto deja de compilar.
    const contract: Record<keyof RepoProvider, true> = {
      getRepo: true,
      listOpenPulls: true,
      getPull: true,
      listPullFiles: true,
      getFileContent: true,
      createCommentReview: true,
    };
    expect(Object.getOwnPropertyNames(GitHubRepoProvider.prototype).sort()).toEqual(
      ['constructor', 'clearCache', ...Object.keys(contract)].sort(),
    );
  });

  const root = resolve(import.meta.dirname, '..', '..', '..', '..');
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.claude']);
  function* sources(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) yield* sources(join(dir, entry.name));
      } else if (
        /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) &&
        !/\.test\.|fake-api/.test(entry.name)
      ) {
        yield join(dir, entry.name);
      }
    }
  }

  it('el código solo llama a pulls.createReview desde el proveedor, con event COMMENT', () => {
    const files = [...sources(root)].map((file) => ({
      file: relative(root, file).replaceAll('\\', '/'),
      text: readFileSync(file, 'utf8'),
    }));
    const callers = files.flatMap(({ file, text }) =>
      [...text.matchAll(/\.createReview\(/g)].map(() => file),
    );
    expect(callers).toEqual(['packages/core/src/github/repo-provider.ts']);

    const forbidden = /APPROVE|REQUEST_CHANGES|submitReview|pulls\.merge|createReviewComment/;
    expect(files.filter(({ text }) => forbidden.test(text)).map(({ file }) => file)).toEqual([]);
    const provider = files.find(({ file }) => file === callers[0]);
    expect(provider?.text.match(/event: .*/g)).toEqual(["event: 'COMMENT',"]);
  });
});

describe('con Octokit real y fetch falso (sin red)', () => {
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    });
  const start = (fetchFn: typeof fetch) =>
    new GitHubRepoProvider(createGitHubClient({ token: 'token-de-prueba', fetch: fetchFn }), db);

  it('envía If-None-Match, acepta el 304 y no lo registra como error', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ default_branch: 'main', html_url: 'https://github.com/acme/api' }, 200, {
          etag: '"e1"',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const provider = start(fetchFn);
      const first = await provider.getRepo(REF);
      await expect(provider.getRepo(REF)).resolves.toEqual(first);
      expect(new Headers(fetchFn.mock.calls[1]?.[1]?.headers).get('if-none-match')).toBe('"e1"');
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('pide el contenido de una ruta anidada con ref', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ type: 'file', encoding: 'base64', content: base64('hola') }));
    await expect(start(fetchFn).getFileContent(REF, 'src/a b?.ts', SHA)).resolves.toBe('hola');
    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(decodeURIComponent(url.pathname)).toBe('/repos/acme/api/contents/src/a b?.ts');
    expect(url.searchParams.get('ref')).toBe(SHA);
  });

  it('manda event COMMENT en el cuerpo de la review', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ html_url: 'https://github.com/acme/api/pull/7' }));
    await start(fetchFn).createCommentReview(REF, 7, {
      commitId: SHA,
      body: 'Resumen.',
      comments: [],
    });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.github.com/repos/acme/api/pulls/7/reviews');
    expect(JSON.parse(String(init?.body))).toMatchObject({ event: 'COMMENT', commit_id: SHA });
  });
});
