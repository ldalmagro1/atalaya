import { RepoName, RepoOwner } from '@atalaya/contracts';
import { z } from 'zod';
import type { Db } from '../db/open.js';
import { AppError } from '../lib/errors.js';
import { GitHubCache } from './cache.js';
import type { GitHubApi } from './client.js';
import { classifyGitHubError, translateGitHubError } from './errors.js';
import type {
  InlineComment,
  PullDetail,
  PullFile,
  PullSummary,
  RepoProvider,
  RepoRef,
} from './types.js';

const PULLS_PER_PAGE = 50;
const FILES_PER_PAGE = 100;
const MAX_FILE_PAGES = 3;

// --- Entrada de quien llama ---

const Ref = z.object({ owner: RepoOwner, name: RepoName });
const PullNumber = z.number().int().positive();
/** Sha completo: un nombre de rama cambia y no se puede cachear sin vencimiento. */
const Sha = z
  .string()
  .regex(/^([0-9a-f]{40}|[0-9a-f]{64})$/i, 'debe ser un sha completo de commit');
/** Sin segmentos `.` o `..`, que cambiarían la URL que se pide a GitHub. */
const FilePath = z
  .string()
  .min(1)
  .refine((path) => path.split('/').every((part) => part !== '.' && part !== '..'), {
    message: 'ruta de archivo inválida',
  });
/** Las claves desconocidas se descartan: a GitHub solo llega lo que figura aquí. */
const Comment = z.object({
  path: z.string().min(1),
  line: z.number().int().positive(),
  side: z.literal('RIGHT'),
  start_line: z.number().int().positive().optional(),
  start_side: z.literal('RIGHT').optional(),
  body: z.string().min(1),
}) satisfies z.ZodType<InlineComment>;
const ReviewInput = z.object({ commitId: Sha, body: z.string(), comments: z.array(Comment) });

// --- Respuestas de GitHub (dato de un tercero) y su forma en la caché ---

const RepoPayload = z.object({ defaultBranch: z.string(), htmlUrl: z.string() });

const PullSummaryPayload = z.object({
  number: z.number(),
  title: z.string(),
  author: z.string(),
  updatedAt: z.string(),
  htmlUrl: z.string(),
}) satisfies z.ZodType<PullSummary>;

const PullDetailPayload = PullSummaryPayload.extend({
  body: z.string().nullable(),
  headSha: z.string(),
  baseSha: z.string(),
  headRef: z.string(),
  baseRef: z.string(),
}) satisfies z.ZodType<PullDetail>;

const PullFilePayload = z.object({
  filename: z.string(),
  status: z.enum(['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged']),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().nullable(),
}) satisfies z.ZodType<PullFile>;

const ContentPayload = z.object({ content: z.string().nullable() });

const RawRepo = z
  .object({ default_branch: z.string(), html_url: z.string() })
  .transform((repo) => ({ defaultBranch: repo.default_branch, htmlUrl: repo.html_url }));

const rawPullShape = {
  number: z.number(),
  title: z.string(),
  // GitHub devuelve `null` si la cuenta del autor ya no existe.
  user: z.object({ login: z.string() }).nullable(),
  updated_at: z.string(),
  html_url: z.string(),
};
const toSummary = (pull: z.infer<z.ZodObject<typeof rawPullShape>>): PullSummary => ({
  number: pull.number,
  title: pull.title,
  author: pull.user?.login ?? 'ghost',
  updatedAt: pull.updated_at,
  htmlUrl: pull.html_url,
});
const RawPullSummary = z.object(rawPullShape).transform(toSummary);

const RawPullDetail = z
  .object({
    ...rawPullShape,
    body: z.string().nullable(),
    head: z.object({ sha: z.string(), ref: z.string() }),
    base: z.object({ sha: z.string(), ref: z.string() }),
  })
  .transform((pull) => ({
    ...toSummary(pull),
    body: pull.body,
    headSha: pull.head.sha,
    baseSha: pull.base.sha,
    headRef: pull.head.ref,
    baseRef: pull.base.ref,
  }));

const RawPullFile = z
  .object({
    filename: z.string(),
    status: PullFilePayload.shape.status,
    additions: z.number(),
    deletions: z.number(),
    patch: z.string().optional(),
  })
  .transform((file) => ({ ...file, patch: file.patch ?? null }));

/** Un submódulo o un enlace simbólico llegan sin `encoding` ni `content`. */
const RawContent = z.object({
  type: z.string(),
  encoding: z.string().optional(),
  content: z.string().optional(),
});

const Response = z.object({
  data: z.unknown(),
  headers: z.object({ etag: z.string().optional() }).optional(),
});

const RawReview = z.object({ data: z.object({ html_url: z.string() }) });

function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null
    ? (error as { status?: unknown }).status
    : undefined;
}

/** Contenido de un archivo en la respuesta de `repos.getContent`; `null` si no lo trae. */
function decodeContent(data: unknown): string | null {
  // Una carpeta llega como lista.
  if (Array.isArray(data)) return null;
  const { type, encoding, content } = RawContent.parse(data);
  // Con más de 1 MB GitHub responde `encoding: 'none'` y sin contenido.
  if (type !== 'file' || encoding !== 'base64' || content === undefined) return null;
  return Buffer.from(content, 'base64').toString('utf8');
}

/** `owner/name:` en minúsculas (GitHub no distingue mayúsculas en ellos). */
const repoPrefix = (ref: RepoRef) => `${ref.owner}/${ref.name}:`.toLowerCase();

const params = (ref: RepoRef) => ({ owner: ref.owner, repo: ref.name });

/**
 * `RepoProvider` sobre GitHub, con caché local en `core_gh_cache` (requiere `runCoreMigrations`).
 * Las listas y los detalles se piden con `If-None-Match`; el contenido por sha es inmutable.
 */
export class GitHubRepoProvider implements RepoProvider {
  readonly #api: GitHubApi;
  readonly #cache: GitHubCache;

  constructor(octokit: GitHubApi, db: Db) {
    this.#api = octokit;
    this.#cache = new GitHubCache(db);
  }

  async getRepo(ref: RepoRef): Promise<{ defaultBranch: string; htmlUrl: string }> {
    const repo = Ref.parse(ref);
    return this.#conditional(`${repoPrefix(repo)}repo`, RepoPayload, RawRepo, (headers) =>
      this.#api.repos.get({ ...params(repo), headers }),
    );
  }

  async listOpenPulls(ref: RepoRef): Promise<PullSummary[]> {
    const repo = Ref.parse(ref);
    return this.#conditional(
      `${repoPrefix(repo)}pulls`,
      z.array(PullSummaryPayload),
      z.array(RawPullSummary),
      (headers) =>
        this.#api.pulls.list({
          ...params(repo),
          state: 'open',
          sort: 'updated',
          direction: 'desc',
          per_page: PULLS_PER_PAGE,
          headers,
        }),
    );
  }

  async getPull(ref: RepoRef, number: number): Promise<PullDetail> {
    const repo = Ref.parse(ref);
    const pull_number = PullNumber.parse(number);
    return this.#conditional(
      `${repoPrefix(repo)}pull:${pull_number}`,
      PullDetailPayload,
      RawPullDetail,
      (headers) => this.#api.pulls.get({ ...params(repo), pull_number, headers }),
    );
  }

  async listPullFiles(ref: RepoRef, number: number): Promise<PullFile[]> {
    const repo = Ref.parse(ref);
    const pull_number = PullNumber.parse(number);
    const files: PullFile[] = [];
    // Cada página tiene su propio ETag.
    for (let page = 1; page <= MAX_FILE_PAGES; page += 1) {
      const batch = await this.#conditional(
        `${repoPrefix(repo)}files:${pull_number}:${page}`,
        z.array(PullFilePayload),
        z.array(RawPullFile),
        (headers) =>
          this.#api.pulls.listFiles({
            ...params(repo),
            pull_number,
            per_page: FILES_PER_PAGE,
            page,
            headers,
          }),
      );
      files.push(...batch);
      if (batch.length < FILES_PER_PAGE) break;
    }
    return files;
  }

  async getFileContent(ref: RepoRef, path: string, sha: string): Promise<string | null> {
    const repo = Ref.parse(ref);
    const filePath = FilePath.parse(path);
    const commit = Sha.parse(sha).toLowerCase();
    const key = `${repoPrefix(repo)}content:${commit}:${filePath}`;
    const cached = this.#cache.read(key, ContentPayload);
    if (cached) return cached.payload.content;

    let content: string | null;
    try {
      const response = await this.#api.repos.getContent({
        ...params(repo),
        path: filePath,
        ref: commit,
      });
      content = decodeContent(Response.parse(response).data);
    } catch (error) {
      // No se cachea: un 404 también puede ser un permiso que falta y se corrige después.
      if (statusOf(error) === 404) return null;
      throw translateGitHubError(error);
    }
    this.#cache.write(key, null, { content });
    return content;
  }

  async createCommentReview(
    ref: RepoRef,
    number: number,
    input: { commitId: string; body: string; comments: InlineComment[] },
  ): Promise<{ htmlUrl: string }> {
    const repo = Ref.parse(ref);
    const pull_number = PullNumber.parse(number);
    const { commitId, body, comments } = ReviewInput.parse(input);
    try {
      const response = await this.#api.pulls.createReview({
        ...params(repo),
        pull_number,
        commit_id: commitId,
        body,
        // Fijo a propósito (ver `RepoProvider`): nunca aprobar ni pedir cambios.
        event: 'COMMENT',
        comments,
      });
      return { htmlUrl: RawReview.parse(response).data.html_url };
    } catch (error) {
      if (statusOf(error) === 422 && comments.length > 0) {
        throw new AppError(
          'INVALID_INLINE_COMMENTS',
          'GitHub rechazó la revisión por comentarios en línea inválidos: cada uno debe apuntar a una línea del diff del PR.',
          422,
        );
      }
      throw translateGitHubError(error);
    }
  }

  /** Borra la caché de un repo o, sin argumento, toda. */
  clearCache(ref?: RepoRef): void {
    this.#cache.clear(ref ? repoPrefix(Ref.parse(ref)) : '');
  }

  /** Lectura con `If-None-Match`: ante un 304 devuelve lo guardado. */
  async #conditional<T>(
    key: string,
    payload: z.ZodType<T>,
    raw: z.ZodType<T>,
    request: (headers: Record<string, string>) => Promise<unknown>,
  ): Promise<T> {
    const cached = this.#cache.read(key, payload);
    const headers: Record<string, string> = cached?.etag ? { 'if-none-match': cached.etag } : {};
    let value: T;
    let etag: string | null;
    try {
      const response = Response.parse(await request(headers));
      value = raw.parse(response.data);
      etag = response.headers?.etag ?? null;
    } catch (error) {
      if (cached?.etag && statusOf(error) === 304) return cached.payload;
      if (classifyGitHubError(error) === 'not_found') this.#cache.delete(key);
      throw translateGitHubError(error);
    }
    this.#cache.write(key, etag, value);
    return value;
  }
}
