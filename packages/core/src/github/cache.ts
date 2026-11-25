import type { z } from 'zod';
import type { Db } from '../db/open.js';

export interface CacheEntry<T> {
  etag: string | null;
  payload: T;
}

/** Acceso a `core_gh_cache`. Solo la librería lee y escribe esa tabla. */
export class GitHubCache {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** `null` si no hay entrada o si lo guardado no cumple el schema (cuenta como no cacheado). */
  read<T>(key: string, schema: z.ZodType<T>): CacheEntry<T> | null {
    const row = this.#db
      .prepare<[string], { etag: string | null; payload_json: string }>(
        'SELECT etag, payload_json FROM core_gh_cache WHERE key = ?',
      )
      .get(key);
    if (!row) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(row.payload_json);
    } catch {
      return null;
    }
    const parsed = schema.safeParse(raw);
    return parsed.success ? { etag: row.etag, payload: parsed.data } : null;
  }

  write(key: string, etag: string | null, payload: unknown): void {
    this.#db
      .prepare(
        `INSERT INTO core_gh_cache (key, etag, payload_json) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET
           etag = excluded.etag,
           payload_json = excluded.payload_json,
           fetched_at = datetime('now')`,
      )
      .run(key, etag, JSON.stringify(payload));
  }

  delete(key: string): void {
    this.#db.prepare('DELETE FROM core_gh_cache WHERE key = ?').run(key);
  }

  /** Borra las entradas cuya clave empieza con `prefix`; sin él, todas. */
  clear(prefix = ''): void {
    // `substr` en vez de `LIKE`: `_` es válido en nombres de repo y en `LIKE` es un comodín.
    this.#db
      .prepare('DELETE FROM core_gh_cache WHERE substr(key, 1, length(?)) = ?')
      .run(prefix, prefix);
  }
}
