/**
 * Request-scoped logger.
 *
 * The package puts the ID on `req.id`. To make it available *everywhere*
 * (services, DB helpers, deep async code) without passing `req` around, we
 * stash it in AsyncLocalStorage. Every log line then carries the ID for free.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

// Keep the most recent log lines in memory so the playground UI can show them.
const MAX_LINES = 200;
export const recentLogs = [];

const COLORS = ["\x1b[36m", "\x1b[33m", "\x1b[35m", "\x1b[32m", "\x1b[34m", "\x1b[91m"];
const RESET = "\x1b[0m";

function colorFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Express middleware: run the rest of the request inside an ALS context. */
export function bindRequestContext(service) {
  return (req, _res, next) => storage.run({ id: req.id, service }, next);
}

export function currentRequestId() {
  return storage.getStore()?.id;
}

function write(level, message, extra) {
  const ctx = storage.getStore() ?? {};
  const id = ctx.id ?? "no-request";
  const service = ctx.service ?? "app";
  const entry = { time: new Date().toISOString(), level, service, requestId: id, message, ...extra };

  recentLogs.push(entry);
  if (recentLogs.length > MAX_LINES) recentLogs.shift();

  const tag = `${colorFor(id)}[${id}]${RESET}`;
  const svc = `\x1b[2m${service.padEnd(9)}${RESET}`;
  const lvl = level === "error" ? `\x1b[31m${level}${RESET}` : level;
  const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
  console.log(`${svc} ${tag} ${lvl.padEnd(5)} ${message}${tail}`);
}

export const log = {
  info: (msg, extra) => write("info", msg, extra),
  warn: (msg, extra) => write("warn", msg, extra),
  error: (msg, extra) => write("error", msg, extra),
};
