PRAGMA foreign_keys = ON;

-- works.id is stable and unique across the catalog:
--   tmdb-m-{id} / tmdb-tv-{id} when TMDB is known (preferred),
--   douban-{id} when only Douban is known,
--   local-… provisional until one of the above is adopted.
-- Do not use ":" in ids (poster filenames are public/posters/{id}.jpg).
CREATE TABLE IF NOT EXISTS works (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('tv', 'movie')),
  zh          TEXT,
  en          TEXT NOT NULL,
  original    TEXT,
  year_start  INTEGER NOT NULL,
  year_end    INTEGER,
  ongoing     INTEGER NOT NULL DEFAULT 0,
  place       TEXT,
  form        TEXT,
  runtime     INTEGER,
  tmdb_id     INTEGER,
  tmdb_type   TEXT CHECK (tmdb_type IN ('tv', 'movie')),
  tmdb_season INTEGER,
  imdb_id     TEXT,
  poster      TEXT
);

CREATE TABLE IF NOT EXISTS work_aliases (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  ord     INTEGER NOT NULL,
  alias   TEXT NOT NULL,
  PRIMARY KEY (work_id, ord)
);

-- TMDB genres attached to a work (many per work). Names stored in both languages for tags.
CREATE TABLE IF NOT EXISTS work_genres (
  work_id  TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL,
  name_zh  TEXT NOT NULL,
  name_en  TEXT NOT NULL,
  PRIMARY KEY (work_id, genre_id)
);

CREATE TABLE IF NOT EXISTS people (
  id        INTEGER PRIMARY KEY,
  en        TEXT NOT NULL,
  zh        TEXT,
  tmdb_id   INTEGER UNIQUE,
  douban_id TEXT UNIQUE,
  photo     TEXT,
  bio_zh    TEXT,
  bio_en    TEXT
);

CREATE TABLE IF NOT EXISTS credits (
  work_id   TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('creator', 'director', 'writer', 'cast')),
  ord       INTEGER NOT NULL,
  person_id INTEGER NOT NULL REFERENCES people(id),
  PRIMARY KEY (work_id, role, ord)
);

-- Our own writing on a work. Only rows with reviewed = 1 are published.
-- playbill / playbill_en are the 场刊 notes that stay with the work across lists.
CREATE TABLE IF NOT EXISTS editorial (
  work_id     TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  plot        TEXT,
  plot_en     TEXT,
  playbill    TEXT,
  playbill_en TEXT,
  reviewed    INTEGER NOT NULL DEFAULT 0
);

-- Douban rates each TV season as its own subject; season is 0 for films.
CREATE TABLE IF NOT EXISTS douban_subjects (
  douban_id  TEXT PRIMARY KEY,
  work_id    TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  season     INTEGER NOT NULL DEFAULT 0,
  title      TEXT,
  year       INTEGER,
  rating     REAL,
  votes      INTEGER,
  fetched_at TEXT
);

-- One row per fetch, so score history is kept. Pages use the latest row per source.
CREATE TABLE IF NOT EXISTS ratings (
  work_id    TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  source     TEXT NOT NULL CHECK (source IN ('douban', 'imdb')),
  value      REAL NOT NULL,
  votes      INTEGER,
  detail     TEXT,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (work_id, source, fetched_at)
);

CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  kicker      TEXT NOT NULL,
  dek         TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('tv', 'movie')),
  ord         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS list_sections (
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  id      TEXT NOT NULL,
  ord     INTEGER NOT NULL,
  name    TEXT NOT NULL,
  blurb   TEXT NOT NULL,
  color   TEXT NOT NULL,
  PRIMARY KEY (list_id, id)
);

CREATE TABLE IF NOT EXISTS list_entries (
  list_id    TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  rank       INTEGER NOT NULL,
  work_id    TEXT NOT NULL REFERENCES works(id),
  section_id TEXT,
  chart      TEXT,
  position   INTEGER,
  note       TEXT,
  PRIMARY KEY (list_id, rank),
  FOREIGN KEY (list_id, section_id) REFERENCES list_sections(list_id, id)
);

-- List-native blurbs (看点), e.g. a New York Times note for that list entry.
CREATE TABLE IF NOT EXISTS list_highlights (
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  hook    TEXT,
  hook_en TEXT,
  PRIMARY KEY (list_id, work_id)
);

-- Person awards (POC: Douban celebrity awards). result is won | nominated.
CREATE TABLE IF NOT EXISTS person_awards (
  id         INTEGER PRIMARY KEY,
  person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  source     TEXT NOT NULL,
  year       INTEGER,
  category   TEXT NOT NULL,
  result     TEXT NOT NULL CHECK (result IN ('won', 'nominated')),
  work_title TEXT,
  work_id    TEXT REFERENCES works(id) ON DELETE SET NULL,
  ord        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS person_awards_person ON person_awards (person_id, ord, year);
