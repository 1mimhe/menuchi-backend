<div align="center">

<img src="./assets/logo.png" alt="MenuChi Logo" width="120">

# MenuChi Backend

**No-code menu builder backend for restaurants**

*Restaurants draft items in a backlog, publish day-based menus, and take orders*

[![CI](https://github.com/1mimhe/menuchi-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/1mimhe/menuchi-backend/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

[![AWS S3](https://img.shields.io/badge/AWS%20S3-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white)](https://aws.amazon.com/s3/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![TSOA](https://img.shields.io/badge/TSOA-FF6B6B?style=for-the-badge)](https://tsoa-community.github.io/docs/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[![](https://img.shields.io/badge/Database%20Schema-8A2BE2?style=for-the-badge)](https://dbdiagram.io/d/menuchi-db-67d2dbb575d75cc844f75bb6)
[![](https://img.shields.io/badge/Refactoring%20Notes-00B4D8?style=for-the-badge)](./REFACTOR.md)
[![](https://img.shields.io/badge/Test%20Coverage-2EA44F?style=for-the-badge)](./COVERAGE.md)

</div>

---

> [!NOTE]
> ### 📋 Project documentation
> - **Refactoring decisions**: [REFACTOR.md](./REFACTOR.md) — what changed and why, per area.
> - **Test status**: [COVERAGE.md](./COVERAGE.md) — real test counts and known gaps.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎨 **Backlog → Menu publishing**
Draft categories and items in a backlog, then publish menus with day-based cylinders

### 🔐 **Authentication**
Owner login (phone + password, session + JWT) and customer login (email OTP), with role and scope checks

</td>
<td width="50%">

### ☁️ **Image handling**
S3 presigned URLs for menu images, image jobs via Redis Streams

### 📖 **API docs**
TSOA-generated Swagger UI at `/docs`

</td>
</tr>
</table>

Additional: order placement with status tracking (`PENDING → PREPARING → DONE`), dashboard order views, `/health` and `/ready` probes, request-id logging.

## 🔄 Workflows

Two flows share the same items:

1. **Backlog Management**
   - `Restaurant → Branch → Backlog → Categories → Items`
   - Creating a restaurant creates a default branch and its backlog.
   - Categories and items drafted here are the reusable pool.
2. **Menu Publishing**
   - `Branch → Menu → Cylinder → MenuCategory → Items`
   - A menu belongs to a branch.
   - A cylinder selects a combination of days (e.g. Monday–Friday) to control when the menu is served.
   - Each cylinder picks categories from the backlog and includes specific items.

## 🔐 Authentication Methods

| User Type | Method | Description |
|-----------|--------|-------------|
| **Restaurant Owner** | Phone Number + Password | `POST /auth/res-signup`, `POST /auth/res-signin`; session cookie + `access-token` JWT |
| **Customer** | Email OTP | `POST /auth/send-otp`, `POST /auth/check-otp`; session user id is the verified email |

Owner routes additionally check scopes (`PermissionScope.Menu/Branch/Restaurant`) in `BaseController`. Auth endpoints are rate-limited (`/auth` 100 req/15 min, `/auth/send-otp` 5 req/10 min) and OTP check allows 5 attempts per email per 10 min.

## 📦 Order Management

- **Order placement**: customers order against a published menu (`POST /menus/{menuId}/orders`).
- **Owner orders**: owners can create orders on behalf of a customer (`POST /menus/{menuId}/orders/by-owner`) and list branch/menu orders with `skip`/`limit`/`isCompleted` filters.
- **Status tracking**: `PENDING → PREPARING → DONE`.
- **Dashboard**: branch-level order overviews via `DashboardService`.

```bash
# customer creates an order (session cookie from OTP login)
curl -b cookies.txt -X POST http://localhost:8000/menus/<menuId>/orders \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"<itemId>","amount":2}]}'
```

## 📁 Project Structure

```
src
├── auth/                  # permissionGuard, sessionSync
├── config/                # env.ts (zod), Redis clients, redisFactory, SessionConfig, swagger.json
├── container.ts           # DI container (createContainer / resolveContainer)
├── controllers/           # Auth, Backlog, Base, Branch, CategoryName, Dashboard,
│                          # Health, Menu, Order, Restaurant, S3
├── db/                    # prisma.ts, schema.prisma
├── events/                # imageEvents (Redis Streams producer)
├── exceptions/            # MenuchiError, AuthError, DatabaseError, NotFoundError, ValidationError
├── index.ts               # entry point (listen + graceful shutdown)
├── lib/logger.ts          # pino logger
├── middlewares/           # Auth, ErrorHandler
├── routes.ts              # TSOA-generated (do not edit by hand)
├── server.ts              # createServer: helmet, CORS, session, /docs, error chain
├── services/              # Auth, Backlog, Branch, CategoryName, Dashboard,
│                          # Menu, Order, Restaurant, S3
├── types/                 # AuthTypes, CategoryTypes, Enums, ErrorTypes, ItemTypes,
│                          # MenuTypes, OrderTypes, RestaurantTypes, S3Types, ...
└── utils/                 # positionRetry, prismaErrors, utils
test
├── agents.ts              # Supertest agent setup
├── factories.ts           # faker factories
├── routers/               # Auth, AuthZ, Backlog, Branch, CategoryName, Menu, Restaurant
├── unit/                  # auth-regressions, phase2-regressions
├── vitest.config.ts       # coverage thresholds: lines 70, branches 60
└── vitest.setup.ts        # DB sync, mocks (S3/Redis streams), cleanup
```

## 🌍 Environment Setup

Single source of truth: `src/config/env.ts` (zod, fails fast on missing/invalid values). Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Key | Default | Notes |
|-----|---------|-------|
| `PORT` | `8000` | API port everywhere (compose, README, Swagger) |
| `NODE_ENV` | `development` | `development \| test \| production` |
| `LOG_LEVEL` | `info` | `fatal…trace` |
| `DATABASE_URL` | — (required) | e.g. `postgres://postgres:postgres@localhost:5432/menuchi` |
| `REDIS_URL` | — (required) | sessions, e.g. `redis://localhost:6379/0` |
| `TRANSFORMERS_REDIS_URL` | — (required) | image stream, e.g. `.../1` |
| `OTP_REDIS_URL` | — (required) | OTP stream, e.g. `.../2` |
| `TRANSFORMERS_STREAM` | `images` | Redis Stream name |
| `OTP_STREAM` | `otps` | Redis Stream name |
| `INTERNAL_OTP_URL` / `INTERNAL_OTP_ENDPOINT` | — (required) | OTP verifier service |
| `S3_BUCKETNAME` / `S3_ENDPOINT` / `S3_ACCESSKEYID` / `S3_SECRETACCESSKEY` / `S3_DEFAULT_KEY` | — (required) | S3 storage |
| `SESSION_SECRET` | — (32+ chars) | session signing |
| `COOKIE_PRIVATE_KEY` | — (16+ chars) | cookie signing |
| `JWT_PRIVATE_KEY` | — (16+ chars) | JWT signing |
| `MENUCHI_FRONT_URL` | `http://localhost:3000` | CORS allowlist (comma-separated) |

> `.env` and `.env.test` are gitignored and never committed. CI injects test values via the workflow.

## 🗄️ Database Schema

Prisma + PostgreSQL. Visual: [DBDiagram](https://dbdiagram.io/d/menuchi-db-67d2dbb575d75cc844f75bb6). Full definition: `src/db/schema.prisma`.

| Model | Purpose |
|-------|---------|
| `User`, `Role`, `UserProfile` | credentials, role assignments, profile data |
| `Restaurant`, `Branch` | restaurant and its branches |
| `Staff` | staff records (staff-role flows not finished yet) |
| `Backlog`, `Category`, `SubCategory`, `CategoryName` | draft pool and reusable names |
| `Item` | menu items (price, ingredients, position) |
| `Menu`, `Cylinder`, `MenuCategory` | published menus with day-based availability |
| `Order`, `OrderItem` | customer orders and line items |
| `Address`, `OpeningTimes` | branch address and hours |

## ⚠️ Error Handling

Errors extend `MenuchiError(message, status, code?, details?)` and are returned as `{ code, message, details }`. Prisma codes are mapped (`P2002 → 409` unique violation, `P2025 → 404` not found, `P2003 → 409` foreign key). Stacks are never sent to clients.

### Validation errors (HTTP 422)

| Code | Meaning |
|------|---------|
| `4220` | Generic validation failure |
| `4221` | Restaurant validation failed |
| `4222` | Category name validation failed |
| `4223` | Item validation failed |
| `4224` | S3 validation failed |
| `4225` | User validation failed |
| `4226` | Cylinder validation failed |
| `4227` | Menu category validation failed |
| `4228` | Menu validation failed |
| `4229` | Branch validation failed |
| `42210` | Address validation failed |
| `42211` | Opening times validation failed |

### Not-found errors (HTTP 404)

| Code | Meaning |
|------|---------|
| `4041` | Restaurant not found |
| `4042` | Category name not found |
| `4043` | Item not found |
| `4044` | Backlog not found |
| `4045` | User not found |
| `4046` | Cylinder not found |
| `4048` | Menu not found |
| `4049` | Branch not found |
| `40412` | Category not found |

### Other

| HTTP | Meaning |
|------|---------|
| `401` | `InvalidCredentialsError`, `InvalidTokenError`, `UnauthorizedError` |
| `403` | `ForbiddenError` (scope check failed) |
| `409` | Unique / foreign-key constraint (`ConstraintsDatabaseError`) |
| `429` | Too many OTP attempts |
| `502` | OTP verification service unavailable |
| `500` | Unexpected error (`Internal error.`) |

Classes live in `src/exceptions/*`; mapping in `src/middlewares/ErrorHandler.ts` and `src/utils/prismaErrors.ts`.

## 🔗 External Services

### 🖼️ **Transformers Service**
Image processing via the `images` Redis Stream (`TRANSFORMERS_REDIS_URL`). The API produces jobs (`src/events/imageEvents.ts`); a separate transformers service + Celery worker consumes them. Not required for tests (mocked).

### 📧 **OTP Service**
One-time passwords via `${INTERNAL_OTP_URL}${INTERNAL_OTP_ENDPOINT}/${email}` plus the `otps` stream. `send-otp`/`check-otp` flows are not covered by automated tests yet (see COVERAGE.md).

## 🚀 Setup and Installation

Node 22 (see `.nvmrc`). Clone and install:

```bash
git clone https://github.com/1mimhe/menuchi-backend.git
cd menuchi-backend
npm ci
cp .env.example .env   # fill real values (see Environment Setup)
npx prisma generate --schema=./src/db/schema.prisma
```

Database (development):

```bash
npm run db-push        # sync schema, dev only
# production uses migrations instead:
npm run db:deploy
```

## Running the Application

1. **Development mode**:

   ```bash
   npm run dev
   ```

   Generates TSOA routes + Swagger before starting. API at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

2. **Production mode**:

   ```bash
   npm run build
   npm start
   ```

3. **Docker (local)**:

   ```bash
   npm run docker:build
   npm run docker:up       # docker-compose.dev.yml, builds :dev image
   ```

   Or production compose: `docker compose up --build -d`. Health: `curl -f http://localhost:8000/health`, readiness: `curl -f http://localhost:8000/ready`.

## 🧪 Testing

Vitest + Supertest. Unit tests run without infrastructure (`SKIP_DB=1`); router tests need live Postgres + Redis (provided in CI via service containers).

```bash
npm test              # watch mode
npm run test:coverage # single run with coverage (CI gate)
SKIP_DB=1 npx vitest run --config ./test/vitest.config.ts test/unit  # no DB needed
```

- `test/unit` — 28 regression tests, passing.
- `test/routers` — 69 HTTP tests across Auth, AuthZ, Backlog, Branch, CategoryName, Menu, Restaurant; run in CI.
- Coverage thresholds (`test/vitest.config.ts`): lines 70, branches 60.
- Known gaps (see COVERAGE.md): OTP endpoints, menu previews/day-items, `by-slug` branch lookup; some router files still call controllers directly instead of HTTP.

```bash
# strict checks (same as CI)
npm run lint
npm run typecheck
npm run format:check
```

## 📚 Documentation

- [REFACTOR.md](./REFACTOR.md) — what changed during the refactor and why, per area.
- [COVERAGE.md](./COVERAGE.md) — test results, coverage gates, and known gaps.
- Interactive API docs: `http://localhost:8000/docs` (Swagger UI, generated by TSOA).

## 📄 License

MIT — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built by Mohammad Hosseini**

</div>
