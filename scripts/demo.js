/**
 * Terminal walkthrough. Start the server first (`npm start`), then run
 * `npm run demo` in another terminal.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

async function hit(path, headers = {}) {
  const r = await fetch(BASE + path, { headers });
  return { status: r.status, headers: r.headers, body: await r.json() };
}

function section(title) {
  console.log(`\n${bold("━━ " + title + " " + "━".repeat(Math.max(0, 60 - title.length)))}`);
}

try {
  await fetch(BASE);
} catch {
  console.error(red(`Can't reach ${BASE}. Run "npm start" first.`));
  process.exit(1);
}

section("1. Strategies");
for (const key of ["uuid", "nanoid", "prefix", "custom", "sequential", "sequential"]) {
  const { body } = await hit(`/api/strategies/${key}`);
  console.log(`${key.padEnd(11)} ${dim(body.code.padEnd(58))} → ${green(body["req.id"])}`);
}

section("2. Header options");
{
  const a = await hit("/api/strategies/header");
  console.log(`custom header   X-Correlation-ID: ${green(a.headers.get("x-correlation-id"))}`);
  const b = await hit("/api/strategies/hidden");
  console.log(`exposeHeader    req.id = ${b.body["req.id"]}, X-Request-ID header = ${b.headers.get("x-request-id") ?? red("(absent)")}`);
}

section("3. Incoming IDs (useIncoming)");
const incomingCases = [
  ["valid upstream id", "lb-7f3a1b:edge-01"],
  ["contains spaces", "hello world"],
  ["200 characters", "x".repeat(200)],
  ["log-forging attempt", "abc] [ADMIN LOGIN OK"],
];
for (const [label, sent] of incomingCases) {
  const v = await hit("/api/strategies/incoming", { "X-Request-ID": sent });
  const u = await hit("/api/strategies/incoming-unsafe", { "X-Request-ID": sent });
  const shown = sent.length > 30 ? sent.slice(0, 27) + "..." : sent;
  const kept = v.body["req.id"] === sent;
  console.log(`${label.padEnd(20)} sent ${dim(JSON.stringify(shown).padEnd(32))}`);
  console.log(`   validated   → ${kept ? green("reused") : red("replaced")} ${dim(v.body["req.id"].slice(0, 40))}`);
  console.log(`   unvalidated → ${u.body["req.id"] === sent ? "accepted as-is" : "replaced"}`);
}

section("4. validateRequestId()");
for (const id of ["abc-123", "trace.id:42", "bad id!", "", "a".repeat(129)]) {
  const r = await fetch(`${BASE}/api/validate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  }).then((r) => r.json());
  const label = JSON.stringify(id.length > 20 ? id.slice(0, 17) + "..." : id);
  console.log(`${label.padEnd(24)} ${r.valid ? green("valid") : red("invalid: " + r.reason)}`);
}

section("5. createRequestIdGenerator()");
{
  const { body } = await hit("/api/generate?strategy=nanoid&prefix=job&count=3");
  console.log(body.ids.map((i) => "  " + i).join("\n"));
}

section("6. Fail-fast config validation");
for (const e of (await hit("/api/config-errors")).body) {
  console.log(`${dim(JSON.stringify(e.options).padEnd(32))} ${red(e.error.replace("[@mohammed_kashif/requestid] ", ""))}`);
}

section("7. Generator that throws → 500");
{
  const r = await hit("/api/strategies/broken");
  console.log(`HTTP ${r.status}  ${JSON.stringify(r.body)}`);
}

section("8. Cross-service tracing (3 concurrent orders)");
{
  const results = await Promise.all(["A-1", "A-2", "A-3"].map((o) => hit(`/api/orders/${o}`)));
  for (const r of results) {
    const downstream = [...new Set(r.body.items.map((i) => i.requestId))];
    console.log(`order ${r.body.orderId}  gateway ${green(r.headers.get("x-request-id"))}  inventory saw ${green(downstream.join(","))}`);
  }
  console.log(dim("  → check the server terminal: every log line is tagged with its ID, across both services"));
}

section("9. Error with a traceable ID");
{
  const r = await hit("/api/orders/fail");
  console.log(`HTTP ${r.status}  ${r.body.hint}`);
}
console.log();
