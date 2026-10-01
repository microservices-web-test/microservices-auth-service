-- V1: initial auth schema + seed data.
-- Applied by the one-shot Flyway "migrate" container, which records it in the
-- flyway_schema_history table so it runs exactly once per database.
CREATE TABLE IF NOT EXISTS users (
  id       SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL
);

INSERT INTO users (username)
VALUES ('alice'), ('bob'), ('carol')
ON CONFLICT (username) DO NOTHING;
