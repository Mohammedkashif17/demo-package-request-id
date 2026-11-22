/**
 * Using the package WITHOUT Express: a background job runner that tags each
 * job with an ID from createRequestIdGenerator(), plus raw generator helpers.
 *
 *   npm run standalone
 */
import {
  createRequestIdGenerator,
  generateUUID,
  generateNanoId,
  validateRequestId,
} from "@mohammed_kashif/requestid";
import { setTimeout as sleep } from "node:timers/promises";

console.log("generateUUID()     →", generateUUID());
console.log("generateNanoId()   →", generateNanoId());
console.log("generateNanoId(10) →", generateNanoId(10));
console.log();

const jobId = createRequestIdGenerator({ strategy: "nanoid", prefix: "job" });

async function runJob(name) {
  const id = jobId();
  const log = (msg) => console.log(`[${id}] ${name.padEnd(14)} ${msg}`);
  log("started");
  await sleep(Math.random() * 200);
  log("halfway");
  await sleep(Math.random() * 200);
  log("done");
  return id;
}

const ids = await Promise.all(["send-emails", "resize-images", "sync-billing"].map(runJob));

console.log("\nAll job IDs pass validateRequestId():", ids.every((id) => validateRequestId(id).valid));

// Uniqueness sanity check
const N = 100_000;
const set = new Set(Array.from({ length: N }, jobId));
console.log(`Generated ${N.toLocaleString()} IDs → ${set.size.toLocaleString()} unique`);
