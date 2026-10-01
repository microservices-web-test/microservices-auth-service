-- Auth service database schema + seed data.
-- Runs automatically the first time the auth-db container is created.
CREATE TABLE IF NOT EXISTS users (
  id       SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL
);

INSERT INTO users (username)
VALUES ('alice'), ('bob'), ('carol')
ON CONFLICT (username) DO NOTHING;
