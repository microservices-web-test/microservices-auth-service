// Unit tests (node:test, no extra deps). The DB pool is faked so no Postgres
// is needed in CI.
const test = require("node:test");
const assert = require("node:assert");
const { createApp } = require("../app");

async function withServer(pool, fn) {
  const server = createApp({ pool }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const okPool = { query: async () => ({ rows: [{ users: 3 }] }) };
const badPool = {
  query: async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.1:5432");
  },
};

test("GET /health is ok without touching the DB", async () => {
  await withServer(badPool, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: "ok" });
  });
});

test("GET / reports user count", async () => {
  await withServer(okPool, async (base) => {
    const body = await (await fetch(`${base}/`)).json();
    assert.strictEqual(body.service, "auth");
    assert.strictEqual(body.db, "connected");
    assert.strictEqual(body.users, 3);
  });
});

test("GET / returns 500 and hides DB error details", async () => {
  await withServer(badPool, async (base) => {
    const res = await fetch(`${base}/`);
    const text = await res.text();
    assert.strictEqual(res.status, 500);
    assert.ok(!text.includes("ECONNREFUSED"));
  });
});

test("GET /ready is 503 when DB is down, 200 when up", async () => {
  await withServer(badPool, async (base) => {
    assert.strictEqual((await fetch(`${base}/ready`)).status, 503);
  });
  await withServer(okPool, async (base) => {
    assert.strictEqual((await fetch(`${base}/ready`)).status, 200);
  });
});

test("GET /metrics exposes Prometheus metrics", async () => {
  await withServer(okPool, async (base) => {
    await fetch(`${base}/`);
    const text = await (await fetch(`${base}/metrics`)).text();
    assert.ok(text.includes("http_request_duration_seconds_count"));
    assert.ok(text.includes("process_cpu_user_seconds_total"));
  });
});
