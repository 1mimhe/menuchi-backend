# Test Execution & Coverage Report

Test results for the MenuChi backend. Router tests need live Postgres + Redis (provided in CI via service containers); unit tests run anywhere.

---

## 1. Summary

| Suite | Framework | Tests | Status |
| :--- | :---: | :---: | :--- |
| **Unit** (`test/unit`) | Vitest | 28 | **PASSED** (verified locally, `SKIP_DB=1`) |
| **Router** (`test/routers`) | Vitest + Supertest | 69 defined | **Run in CI** (needs live Postgres + Redis) |
| **Static analysis** | `tsc --noEmit` + ESLint + Prettier | Full `src` + `test` | **Green** |
| **Total defined** | — | **97** | — |

Coverage gates (`test/vitest.config.ts`, v8 provider): lines 70, branches 60. Reports: `text` + `lcov`.

---

## 2. Unit Test Results

Executed locally via `SKIP_DB=1 npx vitest run --config ./test/vitest.config.ts test/unit`:

```text
Test Files: 2 passed (2)
Tests:      28 passed (28)
```

| File | Tests | Covers |
| :--- | :---: | :--- |
| `test/unit/phase2-regressions.test.ts` | 17 | Error mapping (P2002/P2025), order partial-ID rejection, pagination, dashboard day-items |
| `test/unit/auth-regressions.test.ts` | 11 | Session/JWT guards, 401/403 paths |

---

## 3. Router (HTTP) Tests

Defined per file (counts of `it`/`test` blocks; executed in CI against Postgres 16 + Redis 7):

| File | Tests | Notes |
| :--- | :---: | :--- |
| `test/routers/Auth.test.ts` | 6 | Signup/signin via Supertest |
| `test/routers/AuthZ.test.ts` | 3 | Cross-owner 403 cases |
| `test/routers/Backlog.test.ts` | 20 | Backlog/category/item flows |
| `test/routers/Branch.test.ts` | 11 | Branch CRUD |
| `test/routers/CategoryName.test.ts` | 3 | Category names |
| `test/routers/Menu.test.ts` | 22 | Menu/cylinder flows |
| `test/routers/Restaurant.test.ts` | 4 | Restaurant flows |

Run the full suite (needs DB + Redis):

```bash
cp .env.example .env   # then point DATABASE_URL/REDIS_* at live services
npm run test:coverage
```

---

## 4. Static Analysis

```bash
npm run lint          # ESLint (relaxed: any off, unused as warn)
npm run typecheck     # tsc --noEmit, 0 errors
npm run format:check  # Prettier, clean
```

`npm run lint:strict` keeps a zero-warning (`--max-warnings=0`) option for local use.

---

## 5. Known Gaps (not yet covered)

- `POST /auth/send-otp`, `POST /auth/check-otp` (`test/routers/Auth.test.ts:80`)
- `GET /users/profile` (`test/routers/Auth.test.ts:81`)
- `DELETE /menus/{menuId}/categories`, menu previews, day items (`test/routers/Menu.test.ts:518-520`)
- `GET /branches/{branchId}/by-slug/{slug}` (`test/routers/Branch.test.ts:72`)
- Several router files still call controllers directly with mocks instead of HTTP (`TODO(Phase-3)` markers in `Backlog`, `Branch`, `Menu`, `Restaurant` tests)

These are listed in §5 above; the remaining work is migrations, OTP/preview coverage, and staff-role flows.
