/**
 * requestid-demo
 *
 * Two services in one process:
 *   - "gateway"   :3000  public API + playground UI; generates fresh IDs
 *   - "inventory" :4001  internal service; REUSES the gateway's ID via
 *                        `useIncoming: true` so one ID traces the whole call
 */
import express from "express";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import {
  requestId,
  validateRequestId,
  createRequestIdGenerator,
} from "@mohammed_kashif/requestid";
import { bindRequestContext, currentRequestId, log, recentLogs } from "./logger.js";
import { strategiesRouter } from "./strategies.js";

const GATEWAY_PORT = Number(process.env.PORT ?? 3000);
const INVENTORY_PORT = Number(process.env.INVENTORY_PORT ?? 4001);
const INVENTORY_URL = `http://localhost:${INVENTORY_PORT}`;

// ─────────────────────────────────────────────────────────────────────────────
// Inventory service (downstream)
// ─────────────────────────────────────────────────────────────────────────────
const inventory = express();

inventory.use(requestId({ useIncoming: true, validateIncoming: true, prefix: "inv" }));
inventory.use(bindRequestContext("inventory"));

inventory.get("/stock/:sku", async (req, res) => {
  log.info(`checking stock for ${req.params.sku}`);
  await sleep(50 + Math.random() * 150); // pretend DB call
  const qty = Math.floor(Math.random() * 20);
  log.info(`stock lookup done`, { sku: req.params.sku, qty });
  res.json({ sku: req.params.sku, qty, servedBy: "inventory", requestId: req.id });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gateway (public)
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

// 1. Every config option, side by side (each sub-router has its own middleware).
app.use("/api/strategies", strategiesRouter());

// 2. Standalone helpers — these don't need the middleware at all.
app.post("/api/validate", (req, res) => {
  const { id } = req.body ?? {};
  res.json({ input: id, ...validateRequestId(id) });
});

app.get("/api/generate", (req, res, next) => {
  try {
    const { strategy = "uuid", prefix = "", count = "5" } = req.query;
    const generate = createRequestIdGenerator({ strategy, prefix });
    const n = Math.min(Math.max(Number(count) || 1, 1), 50);
    res.json({ strategy, prefix, ids: Array.from({ length: n }, generate) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Config is validated at startup — show what bad configs throw.
app.get("/api/config-errors", (_req, res) => {
  const bad = [
    { headerName: "Bad Header!" },
    { strategy: "sha256" },
    { prefix: "bad prefix!" },
    { generator: "not a function" },
    { useIncoming: "yes" },
  ];
  res.json(
    bad.map((options) => {
      try {
        requestId(options);
        return { options, error: null };
      } catch (err) {
        return { options, error: `${err.name}: ${err.message}` };
      }
    }),
  );
});

app.get("/api/logs", (req, res) => {
  const since = req.query.since ?? "";
  res.json(recentLogs.filter((l) => l.time > since));
});

// 4. The real thing: global middleware + request-scoped logging + propagation.
app.use("/api", requestId({ strategy: "nanoid", prefix: "req" }));
app.use("/api", bindRequestContext("gateway"));
app.use("/api", (req, res, next) => {
  const start = performance.now();
  log.info(`→ ${req.method} ${req.originalUrl}`);
  res.on("finish", () =>
    log.info(`← ${res.statusCode} in ${(performance.now() - start).toFixed(1)}ms`),
  );
  next();
});

app.get("/api/orders/:orderId", async (req, res, next) => {
  try {
    const { orderId } = req.params;
    log.info(`loading order ${orderId}`);
    await sleep(30 + Math.random() * 100);

    const skus = ["SKU-RED", "SKU-BLUE"];
    log.info(`calling inventory for ${skus.length} items`);

    // Propagate the ID: inventory has useIncoming:true, so it keeps ours.
    const stock = await Promise.all(
      skus.map((sku) =>
        fetch(`${INVENTORY_URL}/stock/${sku}`, {
          headers: { "X-Request-ID": currentRequestId() },
        }).then((r) => r.json()),
      ),
    );

    if (orderId === "fail") throw new Error("payment provider timed out");

    log.info(`order assembled`);
    res.json({ orderId, requestId: req.id, items: stock });
  } catch (err) {
    next(err);
  }
});

// Error handler: the ID is the thing a user can quote to support.
app.use((err, req, res, _next) => {
  log.error(err.message);
  res.status(500).json({
    error: "Something went wrong",
    detail: err.message,
    requestId: req.id ?? null,
    hint: req.id ? `Quote ${req.id} when contacting support` : "No ID was assigned",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
inventory.listen(INVENTORY_PORT, () =>
  console.log(`inventory  listening on ${INVENTORY_URL}`),
);
app.listen(GATEWAY_PORT, () =>
  console.log(`gateway    listening on http://localhost:${GATEWAY_PORT}  (open it in a browser)`),
);
