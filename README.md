# requestid-demo

A hands-on demo of [`@mohammed_kashif/requestid`](https://www.npmjs.com/package/@mohammed_kashif/requestid), the Express middleware that gives every HTTP request a unique ID.

## Run it

```bash
npm install
npm start           # gateway on :3000, inventory service on :4001
```

Open http://localhost:3000 for the interactive playground. Then, in a second terminal:

```bash
npm run demo        # scripted walkthrough of every feature
npm run standalone  # using the package without Express (job IDs)
```

## What it shows

| # | Feature | Where |
|---|---------|-------|
| 1 | `uuid` / `nanoid` strategies, `prefix`, custom `generator` | `src/strategies.js` → `/api/strategies/:name` |
| 2 | `headerName` (`X-Correlation-ID`) and `exposeHeader: false` | `/api/strategies/header`, `/hidden` |
| 3 | `useIncoming` with and without `validateIncoming` (spaces, 200-char, log-forging inputs) | `/api/strategies/incoming`, `/incoming-unsafe` |
| 4 | `validateRequestId()` | `POST /api/validate` |
| 5 | `createRequestIdGenerator()`, `generateUUID()`, `generateNanoId()` | `/api/generate`, `scripts/standalone.js` |
| 6 | Fail-fast config validation (bad options throw on `requestId()` call) | `/api/config-errors` |
| 7 | Custom generator that throws → 500 | `/api/strategies/broken` |
| 8 | **Cross-service tracing**: the gateway assigns `req_…`, forwards it in `X-Request-ID`, and the inventory service (`useIncoming: true`) keeps it, so one ID tags log lines in both services | `src/server.js` → `/api/orders/:id` |
| 9 | Error responses that include the request ID for support | `/api/orders/fail` |

`src/logger.js` puts `req.id` into `AsyncLocalStorage`, so any code (not just route handlers) can log with the current request's ID without passing `req` around.
