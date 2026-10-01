// Auth microservice.
// Exposes a tiny HTTP API and talks to its OWN dedicated PostgreSQL database
// (auth-db). It is completely independent from the payment service and from the
// frontend — the only thing they share is a Docker network so the frontend can
// reach this container by name (http://auth-service:3000).

const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Connection details come from environment variables (12-factor config).
// Defaults match docker-compose.yml so it also runs with `node server.js`
// against a local Postgres if you ever want to.
const pool = new Pool({
  host: process.env.DB_HOST || "auth-db",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "auth",
  password: process.env.DB_PASSWORD || "authpass",
  database: process.env.DB_NAME || "authdb",
});

// Main route the frontend proxy hits. It proves end-to-end connectivity by
// actually querying the database, then returns success.
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT count(*)::int AS users FROM users");
    res.json({
      service: "auth",
      status: "success",
      message: "Auth API is Live",
      db: "connected",
      users: result.rows[0].users,
    });
  } catch (err) {
    res.status(500).json({
      service: "auth",
      status: "error",
      db: "unreachable",
      error: err.message,
    });
  }
});

// Lightweight health endpoint (no DB dependency) for container healthchecks.
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`auth-service listening on port ${PORT}`));
