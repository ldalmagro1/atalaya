export interface RepoRef {
  owner: string;
  name: string;
}

export interface PullSummary {
  number: number;
  title: string;
  author: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface PullDetail extends PullSummary {
  body: string | null;
  headSha: string;
  baseSha: string;
  headRef: string;
  baseRef: string;
}

export interface PullFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface InlineComment {
  path: string;
  line: number;
  side: 'RIGHT';
  start_line?: number;
  start_side?: 'RIGHT';
  body: string;
}

/**
 * Acceso de las herramientas a un repositorio. Por seguridad, la única escritura es
 * `createCommentReview`: no hay forma de aprobar, pedir cambios ni fusionar un PR.
 */
export interface RepoProvider {
  getRepo(ref: RepoRef): Promise<{ defaultBranch: string; htmlUrl: string }>;
  /** Hasta 50 PRs abiertos, del actualizado más recientemente al más antiguo. */
  listOpenPulls(ref: RepoRef): Promise<PullSummary[]>;
  getPull(ref: RepoRef, number: number): Promise<PullDetail>;
  /** Hasta 300 archivos (páginas de 100). */
  listPullFiles(ref: RepoRef, number: number): Promise<PullFile[]>;
  /** Contenido de un archivo en un commit; `null` si no hay un archivo legible en esa ruta. */
  getFileContent(ref: RepoRef, path: string, sha: string): Promise<string | null>;
  createCommentReview(
    ref: RepoRef,
    number: number,
    input: { commitId: string; body: string; comments: InlineComment[] },
  ): Promise<{ htmlUrl: string }>;
}
