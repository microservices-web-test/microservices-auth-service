// Auth microservice entrypoint: configures the DB pool, starts the HTTP server
// and shuts down gracefully on SIGTERM (sent by Kubernetes on every rollout).

const { Pool } = require("pg");
const { createApp, log } = require("./app");

const PORT = process.env.PORT || 3000;

// 12-factor config. Defaults match docker-compose.yml for local development.
const pool = new Pool({
  host: process.env.DB_HOST || "auth-db",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "auth",
  password: process.env.DB_PASSWORD || "authpass",
  database: process.env.DB_NAME || "authdb",
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 5000,
});

// Without a handler an idle-client error would crash the process.
pool.on("error", (err) => log("error", "idle db client error", { error: err.message }));

const server = createApp({ pool }).listen(PORT, () =>
  log("info", `auth-service listening on port ${PORT}`),
);

function shutdown(signal) {
  log("info", `received ${signal}, shutting down`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  // Hard stop if connections refuse to drain.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
