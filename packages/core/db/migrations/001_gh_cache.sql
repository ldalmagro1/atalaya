CREATE TABLE core_gh_cache (
  key TEXT PRIMARY KEY,
  etag TEXT,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
