CREATE TABLE IF NOT EXISTS game_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS game_cache_created ON game_cache (created);

CREATE TABLE IF NOT EXISTS game_results (
  id INTEGER PRIMARY KEY,
  day TEXT NOT NULL,
  version TEXT NOT NULL,
  level INTEGER NOT NULL,
  mode INTEGER NOT NULL,
  waves TEXT NOT NULL
);
