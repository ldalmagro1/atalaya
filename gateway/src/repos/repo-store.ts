import { z } from 'zod';
import { AppError, type Db } from '@atalaya/core';
import { RepoConfig, defaultRepoConfig, type Repo } from '@atalaya/contracts';

interface RepoRow {
  id: number;
  owner: string;
  name: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

/** Convierte una fila en `Repo`. Una config guardada inválida es un error, no se repara. */
function toRepo(row: RepoRow): Repo {
  const invalid = (detail: string) =>
    new AppError(
      'INVALID_STORED_CONFIG',
      `La configuración guardada de ${row.owner}/${row.name} no es válida (${detail}). Corríjala con PUT /api/repos/${row.id}/config.`,
      500,
    );
  let raw: unknown;
  try {
    raw = JSON.parse(row.config_json);
  } catch {
    throw invalid('no es JSON');
  }
  const parsed = RepoConfig.safeParse(raw);
  if (!parsed.success) {
    throw invalid(parsed.error.issues.map((i) => i.path.join('.') || '(raíz)').join(', '));
  }
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    config: parsed.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = 'id, owner, name, config_json, created_at, updated_at';

/** Acceso a `gateway_repos`. Owner y name se comparan sin distinguir mayúsculas (GitHub). */
export class RepoStore {
  constructor(private readonly db: Db) {}

  list(): Repo[] {
    const rows = this.db
      .prepare<[], RepoRow>(`SELECT ${COLUMNS} FROM gateway_repos ORDER BY id`)
      .all();
    return rows.map(toRepo);
  }

  get(id: number): Repo | null {
    const row = this.db
      .prepare<[number], RepoRow>(`SELECT ${COLUMNS} FROM gateway_repos WHERE id = ?`)
      .get(id);
    return row ? toRepo(row) : null;
  }

  getByOwnerName(owner: string, name: string): Repo | null {
    const row = this.db
      .prepare<[string, string], RepoRow>(
        `SELECT ${COLUMNS} FROM gateway_repos
         WHERE owner = ? COLLATE NOCASE AND name = ? COLLATE NOCASE`,
      )
      .get(owner, name);
    return row ? toRepo(row) : null;
  }

  /** 409 `REPO_EXISTS` si ya está registrado, aunque su config guardada sea inválida. */
  assertNotRegistered(owner: string, name: string): void {
    const exists = this.db
      .prepare<[string, string], { id: number }>(
        `SELECT id FROM gateway_repos WHERE owner = ? COLLATE NOCASE AND name = ? COLLATE NOCASE`,
      )
      .get(owner, name);
    if (exists) {
      throw new AppError('REPO_EXISTS', `El repositorio ${owner}/${name} ya está registrado.`, 409);
    }
  }

  /** Crea el repo con la config por defecto; 409 `REPO_EXISTS` si ya existe. */
  create(owner: string, name: string): Repo {
    this.assertNotRegistered(owner, name);
    const result = this.db
      .prepare('INSERT INTO gateway_repos (owner, name, config_json) VALUES (?, ?, ?)')
      .run(owner, name, JSON.stringify(defaultRepoConfig()));
    const created = this.get(Number(result.lastInsertRowid));
    if (!created) throw new Error('No se pudo leer el repositorio recién creado');
    return created;
  }

  /**
   * Secciones `tools` guardadas, aunque el resto de la config sea inválido (para poder
   * repararlo sin perderlas); `{}` si no se pueden leer y `null` si el repo no existe.
   */
  getStoredTools(id: number): RepoConfig['tools'] | null {
    const row = this.db
      .prepare<[number], Pick<RepoRow, 'config_json'>>(
        'SELECT config_json FROM gateway_repos WHERE id = ?',
      )
      .get(id);
    if (!row) return null;
    try {
      const stored: unknown = JSON.parse(row.config_json);
      return z.object({ tools: RepoConfig.shape.tools }).parse(stored).tools;
    } catch {
      return {};
    }
  }

  /** Reemplaza la config completa; `null` si el repo no existe. */
  updateConfig(id: number, config: RepoConfig): Repo | null {
    const result = this.db
      .prepare(
        `UPDATE gateway_repos SET config_json = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(JSON.stringify(config), id);
    return result.changes === 0 ? null : this.get(id);
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM gateway_repos WHERE id = ?').run(id).changes > 0;
  }
}
