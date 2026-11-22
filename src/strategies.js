/**
 * One mini-router per middleware configuration, so every option of
 * `requestId()` can be tried side by side from the same server.
 */
import express from "express";
import { randomBytes } from "node:crypto";
import { requestId } from "@mohammed_kashif/requestid";

let counter = 0;

export const strategies = {
  uuid: {
    title: "UUID v4 (default)",
    code: "requestId()",
    options: {},
  },
  nanoid: {
    title: "Nano ID",
    code: 'requestId({ strategy: "nanoid" })',
    options: { strategy: "nanoid" },
  },
  prefix: {
    title: "Prefixed ID",
    code: 'requestId({ strategy: "nanoid", prefix: "shop" })',
    options: { strategy: "nanoid", prefix: "shop" },
  },
  header: {
    title: "Custom header name",
    code: 'requestId({ headerName: "X-Correlation-ID" })',
    options: { headerName: "X-Correlation-ID" },
  },
  custom: {
    title: "Custom generator",
    code: 'requestId({ generator: () => `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}` })',
    options: { generator: () => `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}` },
  },
  sequential: {
    title: "Custom generator (sequential)",
    code: 'requestId({ prefix: "seq", generator: () => String(++counter).padStart(6, "0") })',
    options: { prefix: "seq", generator: () => String(++counter).padStart(6, "0") },
  },
  hidden: {
    title: "Header hidden",
    code: "requestId({ exposeHeader: false })",
    options: { exposeHeader: false },
  },
  incoming: {
    title: "Reuse incoming ID (validated)",
    code: "requestId({ useIncoming: true, validateIncoming: true })",
    options: { useIncoming: true, validateIncoming: true },
  },
  "incoming-unsafe": {
    title: "Reuse incoming ID (NOT validated)",
    code: "requestId({ useIncoming: true, validateIncoming: false })",
    options: { useIncoming: true, validateIncoming: false },
  },
  broken: {
    title: "Generator that throws",
    code: 'requestId({ generator: () => { throw new Error("ID service down") } })',
    options: { generator: () => { throw new Error("ID service down"); } },
  },
};

export function strategiesRouter() {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json(Object.entries(strategies).map(([key, s]) => ({ key, title: s.title, code: s.code })));
  });

  for (const [key, s] of Object.entries(strategies)) {
    const sub = express.Router();
    sub.use(requestId(s.options));
    sub.get("/", (req, res) => {
      const headerName = s.options.headerName ?? "X-Request-ID";
      res.json({
        strategy: key,
        code: s.code,
        "req.id": req.id,
        sentIncomingHeader: req.get(headerName) ?? null,
        responseHeader: { name: headerName, value: res.getHeader(headerName) ?? null },
      });
    });
    router.use(`/${key}`, sub);
  }

  return router;
}
