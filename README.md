<div align="center">

<img src="./assets/logo.png" alt="MenuChi Logo" width="120">

# MenuChi Backend

**No-Code Menu Builder for Restaurants**

*Empowering restaurant owners to create interactive digital menus effortlessly*

[![CI](https://github.com/1mimhe/menuchi-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/1mimhe/menuchi-backend/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-22-green?logo=node.js&logoColor=white)](./.nvmrc)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](./Dockerfile)
[![](https://img.shields.io/badge/Database%20Schema-8A2BE2)](https://dbdiagram.io/d/menuchi-db-67d2dbb575d75cc844f75bb6)

</div>

## ✨ Features

| Area | What it does |
|------|--------------|
| 🎨 No-Code Experience | Build backlogs → publish menus with day-based cylinders, no coding |
| 🔐 Secure Auth | Owner session-cookie + JWT, customer email OTP, RBAC scopes, rate limits, OTP brute-force guard |
| ☁️ Cloud Storage | S3 presigned URLs for menu images via Redis Streams (`images`) |
| 📖 Auto Documentation | TSOA-generated Swagger at `/docs` |
| 📦 Orders | Customer ordering with status flow `PENDING → PREPARING → DONE` |
| 🏥 Observability | `pino` logs with request id, `/health` liveness, `/ready` readiness, graceful shutdown |

## 🚀 Quickstart (5 min)

Prerequisites: Node 22 (`nvm use`), Docker Compose.

```bash
git clone https://github.com/1mimhe/menuchi-backend.git
cd menuchi-backend
cp .env.example .env   # fill S3 + secrets, defaults work for Postgres/Redis locally
docker compose -f docker-compose.dev.yml up --build -d
curl -f http://localhost:8000/health
curl -f http://localhost:8000/ready
# open http://localhost:8000/docs — try login + create order via Swagger
```

Production compose: `docker compose up --build -d` (uses `:stable` image, same `/health` check).

Local dev without Docker:

```bash
npm ci
npx prisma generate --schema=./src/db/schema.prisma
npm run db-push        # dev only; prod uses npm run db:deploy
npm run dev            # http://localhost:8000
```

## 🔄 Workflows

1. **Backlog Management** — `Restaurant → Branch → Backlog → Categories → Items`
   - Creating a restaurant auto-creates a default branch + backlog.
   - Draft categories/items live here.
2. **Menu Publishing** — `Branch → Menu → Cylinder → MenuCategory → Items`
   - A `Cylinder` is a day-combination (e.g. Mon–Fri, weekend) controlling availability.
   - Categories are reused from backlog per cylinder.

See `ARCHITECTURE.md` + [DBDiagram](https://dbdiagram.io/d/menuchi-db-67d2dbb575d75cc844f75bb6).

## 🔐 Authentication

| User Type | Method | Description |
|-----------|--------|-------------|
| Restaurant Owner | Phone + Password (`POST /auth/res-signup`, `POST /auth/res-signin`) | Session cookie + `access-token` JWT |
| Customer | Email OTP (`POST /auth/send-otp`, `POST /auth/check-otp`) | Session `user.id = email`, role `RestaurantCustomer` |

```bash
# owner login (stores session cookie)
curl -c cookies.txt -X POST http://localhost:8000/auth/res-signin \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"09123456789","password":"secret123"}'

# customer OTP flow
curl -X POST http://localhost:8000/auth/send-otp \
  -H 'Content-Type: application/json' -d '{"email":"guest@example.com"}'
curl -c cookies.txt -X POST http://localhost:8000/auth/check-otp \
  -H 'Content-Type: application/json' -d '{"email":"guest@example.com","code":"123456"}'
```

## 📦 Orders

```bash
# customer creates an order against a published menu
curl -b cookies.txt -X POST http://localhost:8000/menus/<menuId>/orders \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"<itemId>","amount":2}]}'

# owner lists menu orders
curl -b cookies.txt 'http://localhost:8000/menus/<menuId>/orders?limit=20'
```

Full contract: Swagger `/docs` + Postman collection in `postman/menuchi.json`.

## 📁 Project Structure

```
src
├── auth/                  # permissionGuard, sessionSync
├── config/                # env.ts (zod), Redis clients, redisFactory, SessionConfig, swagger.json
├── container.ts           # DI container (resolveContainer)
├── controllers/           # Auth, Backlog, Base, Branch, CategoryName, Dashboard, Health, Menu, Order, Restaurant, S3
├── db/                    # prisma.ts, schema.prisma
├── events/                # imageEvents (Redis Streams producer)
├── exceptions/            # MenuchiError, AuthError, DatabaseError, NotFoundError, ValidationError
├── index.ts               # entry (listen + graceful shutdown)
├── lib/logger.ts          # pino
├── middlewares/           # Auth, ErrorHandler
├── routes.ts              # TSOA-generated (do not edit)
├── server.ts              # createServer (helmet, cors, session, /docs, error chain)
├── services/              # Auth, Backlog, Branch, CategoryName, Dashboard, Menu, Order, Restaurant, S3
├── types/                 # AuthTypes, CategoryTypes, Enums, ErrorTypes, ItemTypes, MenuTypes, OrderTypes, ...
└── utils/                 # positionRetry, prismaErrors, utils
test
├── agents.ts              # Supertest agent setup
├── factories.ts           # faker factories
├── routers/               # Auth, AuthZ, Backlog, Branch, CategoryName, Menu, Restaurant
├── unit/                  # auth-regressions, phase2-regressions
├── vitest.config.ts
└── vitest.setup.ts
```

## 🌍 Environment Setup

Single source: `src/config/env.ts` (zod, fail-fast). Copy `.env.example` → `.env`.

| Key | Default | Notes |
|-----|---------|-------|
| `PORT` | `8000` | compose, README, Swagger all use 8000 |
| `NODE_ENV` | `development` | `development\|test\|production` |
| `LOG_LEVEL` | `info` | `fatal..trace` |
| `DATABASE_URL` | — (required) | e.g. `postgres://postgres:postgres@localhost:5432/menuchi` |
| `REDIS_URL` / `TRANSFORMERS_REDIS_URL` / `OTP_REDIS_URL` | — (required) | dbs `0/1/2` locally |
| `TRANSFORMERS_STREAM` | `images` | Redis Stream |
| `OTP_STREAM` | `otps` | Redis Stream |
| `INTERNAL_OTP_URL` / `INTERNAL_OTP_ENDPOINT` | — (required) | OTP verifier service |
| `S3_BUCKETNAME` / `S3_ENDPOINT` / `S3_ACCESSKEYID` / `S3_SECRETACCESSKEY` / `S3_DEFAULT_KEY` | — (required) | S3 storage |
| `SESSION_SECRET` | — (32+ chars) | session signing |
| `COOKIE_PRIVATE_KEY` | — (16+ chars) | cookie signing |
| `JWT_PRIVATE_KEY` | — (16+ chars) | JWT signing |
| `MENUCHI_FRONT_URL` | `http://localhost:3000` | CORS allowlist (comma-separated) |

> Never commit `.env` / `.env.test` (gitignored). CI injects secrets via `${{ secrets.* }}`.

## 🗄️ Database Schema

Prisma + Postgres. Visual: [DBDiagram](https://dbdiagram.io/d/menuchi-db-67d2dbb575d75cc844f75bb6).
Key models: `User`, `Role`, `Restaurant`, `Branch`, `Backlog`, `CategoryName`, `Category`, `Item`, `Cylinder`, `Menu`, `MenuCategory`, `Order`, `OrderItem`, `Address`, `OpeningTimes`.
See `src/db/schema.prisma`.

## ⚠️ Error Handling

Base: `MenuchiError(message, status, code?, details?)` → `{ code, message, details }`. Prisma `P2002 → 409`, `P2025 → 404`, `P2003 → 409 FK`.

| HTTP | Code | Meaning |
|------|------|---------|
| 422 | `4220` | Generic validation failure |
| 422 | `4221`–`42211` | Entity validation: Restaurant `4221`, CategoryName `4222`, Item `4223`, S3 `4224`, User `4225`, Cylinder `4226`, MenuCategory `4227`, Menu `4228`, Branch `4229`, Address `42210`, OpeningTimes `42211` |
| 404 | `4042` | CategoryName not found (others use generic 404) |
| 404 | `4043` | Item not found |
| 409 | — | Unique / FK constraint (`ConstraintsDatabaseError`) |
| 401/403 | — | `InvalidCredentialsError` / `ForbiddenError` / `UnauthorizedError` |
| 429 | — | Too many OTP attempts |
| 502 | — | OTP service unavailable |

Classes: `MenuchiError`, `AuthError`, `DatabaseError`, `NotFoundError`, `ValidationError` in `src/exceptions/*`, mapped in `src/middlewares/ErrorHandler.ts`.

## 🔗 External Services

- **Transformers Service** — image processing via Redis Stream `images` (`TRANSFORMERS_REDIS_URL`).
- **OTP Service** — email OTP via `${INTERNAL_OTP_URL}${INTERNAL_OTP_ENDPOINT}/${email}` + Stream `otps`.

## 🧪 Testing

Vitest + Supertest, real Prisma queries, mocked S3/Redis where noted.

```bash
npm test              # watch mode
npm run test:coverage # CI gate with coverage
```

Structure: `test/routers/*` (HTTP), `test/unit/*` (regressions), `test/factories.ts` (faker), `test/agents.ts` (login helper).

## 🛠️ Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | TSOA gen + ts-node |
| `npm run build` / `npm start` | Compile / run prod (`build/index.js`) |
| `npm run lint` / `lint:strict` | ESLint (relaxed / `--max-warnings=0`) |
| `npm run typecheck` | `tsc --noEmit` (run after `prisma generate`) |
| `npm run format` / `format:check` | Prettier write/check |
| `npm run db-push` | `prisma db push` (dev only) |
| `npm run db:migrate:dev` / `db:deploy` | Migrations dev / prod |
| `npm run docker:build` / `docker:up` | Build `:dev` image / compose dev |
| `npm run prisma:studio` | Prisma Studio |

## 🗺️ Roadmap

- Admin dashboard → staff roles → CDN for images → OpenTelemetry
- Prisma migrations in prod entrypoint (currently `db push` dev-only)
- Coverage badge + demo GIF in `assets/demo/`

See `CHANGELOG.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `SECURITY.md`.

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**Made with ❤️ by the [MenuChi Team](https://github.com/1mimhe/menuchi-backend)**

</div>
