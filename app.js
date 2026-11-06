// Express app factory. Kept separate from server.js so tests can inject a fake
// DB pool and so the process lifecycle (listen/shutdown) lives in one place.

const express = require("express");
const client = require("prom-client");

// One JSON object per line on stdout -> trivially shipped by Filebeat/Fluent Bit
// into Elasticsearch without any parsing rules.
function log(level, message, fields = {}) {
  process.stdout.write(
    JSON.stringify({
      "@timestamp": new Date().toISOString(),
      level,
      service: "auth",
      message,
      ...fields,
    }) + "\n",
  );
}

function createApp({ pool }) {
  const app = express();
  app.disable("x-powered-by");

  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry });

  const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request latency in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });
  const dbQueryErrors = new client.Counter({
    name: "db_query_errors_total",
    help: "Failed database queries",
    registers: [registry],
  });

  // Access log + latency metric for every request.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      // Use the route pattern (not the raw URL) to keep label cardinality low.
      const route = req.route ? req.route.path : "unmatched";
      httpDuration.observe(
        { method: req.method, route, status_code: res.statusCode },
        seconds,
      );
      if (route !== "/metrics" && route !== "/health") {
        log("info", "request", {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: Math.round(seconds * 1000),
          client_ip: req.headers["x-real-ip"] || req.ip,
        });
      }
    });
    next();
  });

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
      dbQueryErrors.inc();
      // Full detail goes to the log; the client only gets a generic message.
      log("error", "database query failed", { error: err.message });
      res.status(500).json({
        service: "auth",
        status: "error",
        db: "unreachable",
        error: "database unavailable",
      });
    }
  });

  // Liveness: process is up (no DB dependency, so a DB outage doesn't restart pods).
  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // Readiness: can this pod actually serve traffic (DB reachable)?
  app.get("/ready", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ready" });
    } catch (err) {
      res.status(503).json({ status: "not ready" });
    }
  });

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });

  return app;
}

module.exports = { createApp, log };
