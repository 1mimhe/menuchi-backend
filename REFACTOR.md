# Architecture Refactoring Notes

What changed during the refactor of the MenuChi backend, and why. Each section describes the previous state and the implemented change with file references.

---

## 1. Overview

The starting point was a working Express + TSOA + Prisma + Redis + S3 backend with real functional gaps: plaintext secrets in CI, unawaited async loops returning empty results, partial order creation, fragile error middleware, an oversized Docker image, drifted compose files, and docs that did not match the code (wrong ports, anchors, error tables).

Work was done in five phases:

| Phase | Focus | Main outcome |
|-------|-------|--------------|
| 1 | Security | Secrets via env/secrets, hardened cookies, helmet + rate limits, OTP abuse guard |
| 2 | Architecture & correctness | DI container, split auth/session/events, Prisma-code errors, bug fixes (B1–B5) |
| 3 | Quality & observability | Lint/format/Husky, zod env, pino logs, `/health` + `/ready`, graceful shutdown, test isolation |
| 4 | DevOps & CI/CD | 3-stage non-root image, fixed entrypoint, unified compose, single CI workflow |
| 5 | Portfolio polish | Accurate README, `LICENSE`, public docs, Postman collection, relaxed-but-green CI |

---

## 2. Security

### Previous State

- `.github/workflows/test-build.yml` and `stable.yaml` contained plaintext `S3_ACCESSKEYID`, `S3_SECRETACCESSKEY`, `SESSION_SECRET`, `COOKIE_PRIVATE_KEY`, `JWT_PRIVATE_KEY`. Anyone with history had credentials.
- `SessionConfig.ts`: `cookie.secure: false` unconditionally, so session cookies were not marked `Secure` in production.
- `AuthController.ts`: manual `Set-Cookie` header construction instead of `res.cookie`; `req.session.destroy` not awaited.
- `middlewares/Auth.ts`: `jwt.verify` inside a `new Promise` executor with `throw`, no `try/catch`; scope check could crash on `undefined`.
- `server.ts`: no `helmet`, no rate limiting. `POST /auth/res-signin` and `POST /auth/send-otp` (unbounded Redis `xAdd`) were brute-force/spam friendly. `POST /auth/check-otp` called the OTP service with `fetch` and no timeout or error mapping.
- `S3Controller.ts`: object keys partly built from client-supplied `restaurantId`/`branchId` with only `branchId` permission-checked.
- `BaseController.ts`: `if (process.env.NODE_ENV === 'test') return;` disabled all permission checks under tests.

### Changes Implemented

- All secrets moved to environment (`.env`, gitignored, validated by `src/config/env.ts`) and GitHub Actions secrets (`${{ secrets.* }}`). CI test values are dummy (S3 is mocked in tests).
- Cookies: `httpOnly: true`, `secure` only in production, `sameSite: 'lax'`, `trust proxy: 1` for Docker/Nginx (`src/config/SessionConfig.ts`, `src/controllers/AuthController.ts`).
- JWT verification rewritten with `try/catch` (`InvalidTokenError` on failure), safe scope checks (`src/middlewares/Auth.ts`).
- Added `helmet` and rate limits: `/auth` 100 req/15 min, `/auth/send-otp` 5 req/10 min (`src/server.ts`).
- OTP check: `fetch` with `AbortSignal.timeout(5000)`, `502` when the verifier is unreachable, max 5 attempts per email per 10 min in Redis (`src/controllers/AuthController.ts`).
- CORS allowlist parsed from `MENUCHI_FRONT_URL` with explicit methods (`src/server.ts`).
- Removed the test authZ bypass; added `AuthZ` router tests including cross-owner 403 cases (`test/routers/AuthZ.test.ts`).

---

## 3. Architecture & Correctness

### Previous State

- Services were module-level singletons (`export default new XService()`); controllers imported them directly. Constructor injection existed but was unused, so services could not be unit-tested with mocks.
- `BaseController.ts` mixed permission checks, session mutation, and Redis Stream publishing.
- `src/types/MenuTypes.ts` imported from `vitest` in production code.
- Redis/S3 clients connected or threw on import.
- `middlewares/ErrorHandler.ts`: error middleware used `throw` instead of `next(error)` (unhandled in Express 4); `notFoundHandler` was registered after error handlers, so unknown routes never reached it.
- Services detected Prisma errors with `error.message.includes('not found' / '..._fkey')`, which breaks on Prisma upgrades.
- Demo-breaking bugs: `DashboardService.getDayItems` used `forEach(async)` and always returned `[]` (B1); order creation accepted partial invalid item IDs (B3); `getAllOrders` dropped `skip/limit/isCompleted` (B4); delete-orders used `@Patch` (B5).
- Position assignment (`aggregate(_max) + 1`) raced under concurrency with no guard.

### Changes Implemented

- Manual DI container: `src/container.ts` (`createContainer` / `resolveContainer(req)`); services are classes with constructor deps; `rg "export default new .*Service" src/` is empty.
- `BaseController` split into `src/auth/permissionGuard.ts`, `src/auth/sessionSync.ts`, `src/events/imageEvents.ts`.
- Removed the vitest import from production types; lazy client factories (`getRedisClient`, S3 via `getS3Service`) created after env validation.
- Middleware order fixed: `RegisterRoutes` → `notFoundHandler` → `errorPreprocessor` → `errorHandler`; preprocessor never throws, always `next(...)` (`src/server.ts`, `src/middlewares/ErrorHandler.ts`).
- Prisma-code mapping in `src/utils/prismaErrors.ts`: `P2002 → 409`, `P2025 → 404`, `P2003 → 409`; unknown routes return JSON 404.
- B1 fixed with flatten + single `Promise.all` (`src/services/DashboardService.ts:71-85`); B3 rejects partial IDs (`if (dbItems.length !== items.length) throw new ItemNotFound()` in `src/services/OrderService.ts:44`); B4 passes pagination through; B5 uses `@Delete` with 204.
- Position writes wrapped in `$transaction` with retry-on-`P2002` (`src/utils/positionRetry.ts`).
- Regression tests: `test/unit/phase2-regressions.test.ts` (17), `test/unit/auth-regressions.test.ts` (11).

---

## 4. Code Quality, Testing & Observability

### Previous State

- No ESLint, Prettier, Husky, or `.nvmrc`; `package.json` had only dev/build/start/test scripts.
- `dotenv.config` scattered across files; `process.env.X!` everywhere; `Number(process.env.PORT!)` could yield `NaN`; no `.env.example`.
- Only `morgan` + `console.log/error`; no request ids; no graceful shutdown.
- Tests: `execSync('npm run db-push')` at import, incomplete table cleanup (pollution across files), `vi.mock` inside `beforeAll`, two servers created at import, static factory strings causing unique collisions, most router tests calling controllers directly, `TODO`s for OTP/previews/day-items/`by-slug`.

### Changes Implemented

- ESLint + Prettier + Husky + lint-staged, `.nvmrc` (Node 22), `lint` / `lint:strict` / `typecheck` / `format:check` scripts. CI lint is intentionally relaxed (`no-explicit-any` off, unused-vars as warn) so warnings don't fail builds; `lint:strict` keeps a zero-warning option.
- Single zod env source `src/config/env.ts` (fail-fast, `PORT` defaults to `8000`) + committed `.env.example`.
- `pino` + `pino-http` with `req.id` (`crypto.randomUUID`), `src/lib/logger.ts`; error handler logs without leaking stacks to clients.
- `HealthController`: `GET /health` (liveness) and `GET /ready` (Postgres `SELECT 1` + Redis `ping`).
- Graceful shutdown in `src/index.ts` (`SIGTERM`/`SIGINT` → `server.close`, `prisma.$disconnect`, `redis.quit`).
- Test setup rewritten (`test/vitest.setup.ts`): top-level hoisted mocks (S3, OTP/transformer Redis), explicit `DATABASE_URL` handoff to Prisma CLI, full FK-safe table cleanup, single server per file, faker factories, negative authZ tests.
- Coverage thresholds in `test/vitest.config.ts`: lines 70, branches 60. Current status in [COVERAGE.md](./COVERAGE.md).

---

## 5. DevOps, Docker & CI/CD

### Previous State

- `Dockerfile`: `COPY ./ ./` before `npm ci` (cache bust on every edit, risk of copying `.env`), full `node_modules` including devDeps into runtime, no non-root user, no `HEALTHCHECK`, reversed `ENTRYPOINT`/`chmod` order.
- `entrypoint.sh`: `prisma db push --schema=schema.prisma` — wrong path (real file is `src/db/schema.prisma`).
- `docker-compose.yml` (prod) used a `:dev` image tag and a gitignored `.docker/.dev.env`; `docker-compose.dev.yml` had no Redis while the API required it; images unpinned (`postgres:latest`, `redis:latest`); Redis healthcheck mutated a key (`incr ping`); hardcoded passwords; portamento `3000` vs `8000` mismatch.
- Two near-duplicate workflows (`stable.yaml`, `test-build.yml`) with `POSTGRES_USERNAME` typo (correct: `POSTGRES_USER`), no Node cache, no lint/typecheck gates, destructive `db-push`, missing `TRANSFORMERS_REDIS_URL`, `:dev` tag pushed even from `main`.
- Later, CI failed on fresh runners twice: missing `prisma generate` before typecheck (110 `Prisma.*` + implicit-`any` errors), then `P1001` (service hostnames instead of `localhost`), then empty test failures (repo secrets unset → zod rejected empty env).

### Changes Implemented

- 3-stage `Dockerfile` (`deps` / `build` / `runtime`, `node:22-bookworm-slim`): dependency layer cached, `tsoa spec-and-routes` + `prisma generate` + `tsc` + `prune --omit=dev` in build, non-root `app` user, `EXPOSE 8000`, `HEALTHCHECK` on `/health` via Node fetch. `.dockerignore` excludes `.env*`, `docs/`, `test/`, `.github`, `node_modules`, `build`.
- `entrypoint.sh`: correct schema path, `set -e`, wait-for-DB retry loop (30 × 2 s). Still `db push` (dev-oriented); production should switch to `prisma migrate deploy` once migrations exist.
- Compose: pinned `postgres:16-bookworm` and `redis:7-alpine`, fixed Redis healthcheck (`redis-cli ping`), added API healthcheck on `/health`, `depends_on` healthy Postgres/Redis, single `.env` story, `PORT` 8000 aligned.
- Single `.github/workflows/ci.yml`: `lint-test` (generate Prisma client → generate TSOA routes → lint → typecheck → format-check → db-push → coverage) then `build-push` with branch-aware tags (`:stable` from `main`, `:dev` from `dev`), `setup-node` cache, `concurrency: cancel-in-progress`.
- CI robustness fixes: service hosts use `localhost` (jobs run on the VM, not in a container), `pg_isready -U postgres -d menuchi` healthcheck, dummy test env values so PRs/forks pass without repo secrets.

---

## 6. Documentation (Phase 5)

### Previous State

- README referenced a missing `.env.example`, had a broken `[Environment Variables](#environment-variables)` anchor, `PORT=3000` vs compose `8000`, `3000:3000` Docker commands, `npx prisma migrate dev` vs the actual `db-push` script, an outdated tree (missing S3/Dashboard/CategoryName/Health controllers), an error-code table (`4000/4041`) that did not match the code (`4221/40412`), no curl examples, no CI badges, no `LICENSE` (despite `package.json` saying ISC and README linking to it), and wrong repo URLs (`menuchi-project/menuchi-app` vs actual `1mimhe/menuchi-backend`).

### Changes Implemented

- README rewritten in the original structure with verified values: port `8000` everywhere, fixed anchors, regenerated tree, full error-code tables read from `src/exceptions/*`, curl login/OTP/order examples, env table generated from `src/config/env.ts`, honest test section with real counts and listed gaps, CI badges.
- `LICENSE` (MIT) added; `package.json` aligned (`menuchi-backend`, `MIT`, keywords, `build/index.js`, correct repo URLs).
- Public docs kept minimal: [REFACTOR.md](./REFACTOR.md) (this file) and [COVERAGE.md](./COVERAGE.md), plus `LICENSE`, `postman/menuchi.json`, and PR/issue templates. Extra guides (`ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `ROADMAP.md`, `docs/01–07`) were removed to keep only README, COVERAGE, and REFACTOR.

---

## 7. Summary Matrix

| Area | Before | After |
| :--- | :--- | :--- |
| Secrets | Plaintext in CI workflows | Env + `${{ secrets.* }}`; dummy test env in CI |
| Cookies | `secure: false` always; manual `Set-Cookie` | `Secure` in prod, `HttpOnly`, `SameSite=lax`, `res.cookie` |
| JWT/authZ | Throwing promise executor; test bypass | `try/catch` verify; scope checks; `AuthZ` tests |
| Headers/limits | No helmet/rate-limit; open CORS | Helmet, `/auth` limits, OTP 5-attempt guard, CORS allowlist |
| DI/layering | Singleton imports; mixed `BaseController` | `container.ts`; guard/session/events split |
| Errors | `throw` in middleware; dead 404; message sniffing | `next()` chain; JSON 404; Prisma-code mapping |
| Day items | `forEach(async)` → always `[]` | Flatten + `Promise.all` |
| Orders | Partial IDs accepted; pagination dropped; `@Patch` delete | Strict IDs; passthrough; `@Delete` 204 |
| Env/config | Scattered `dotenv`; `process.env!` | Single zod `env.ts` + `.env.example` |
| Logging/health | `console.*`; no probes/shutdown | pino + req id; `/health` + `/ready`; graceful shutdown |
| Tests | Import-time `db-push`; pollution; static factories | Hoisted mocks; FK-safe cleanup; faker; 28 unit passing |
| Docker | Bloated root image; wrong entrypoint path | 3-stage non-root + healthcheck; retry entrypoint |
| Compose | `:dev` in prod; missing Redis; unpinned | Pinned; Redis included; health-gated; port 8000 |
| CI | Duplicated; typo; no gates; fragile hosts/secrets | Single workflow; cached; localhost; dummy env |
| Docs | Wrong ports/anchors/tree/codes/URLs | Verified README; REFACTOR + COVERAGE kept, extras removed |
