# Contributing to MenuChi Backend

Thanks for contributing. This repo follows a short, enforced workflow.

## Setup

```bash
cp .env.example .env        # fill real values, never commit .env
npm ci
npx prisma generate --schema=./src/db/schema.prisma
npm run db-push              # dev only; prod uses `npm run db:deploy`
npm run dev                  # http://localhost:8000, Swagger at /docs
```

Node version is pinned in `.nvmrc` (22). Use it (`nvm use` / `fnm use`).

## Branch naming

- `feat/<scope>` — features, refactors
- `fix/<scope>` — bug fixes
- `docs/<scope>` — docs only
- `chore/<scope>` — CI, deps, tooling

Base new work on `dev`. `main` is release-only (`:stable` image).

## Commit convention

Conventional Commits: `feat|fix|docs|chore|test|refactor(scope): message`

Examples: `feat(order): validate partial ids`, `fix(ci): generate prisma before typecheck`.

Husky + lint-staged runs `eslint --fix` and `prettier --write` on staged `src/**` and `test/**`.

## Before pushing

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
```

CI (`.github/workflows/ci.yml`) runs the same: generate → lint → typecheck → format → db-push → coverage. PRs must be green.

## PR checklist

- [ ] `npm run lint && npm run typecheck && npm run format:check` green
- [ ] Tests added/updated; `npm run test:coverage` passes
- [ ] `.env.example` / `README.md` updated if env or API changed
- [ ] Swagger (`/docs`) verified for new/changed routes
- [ ] No secrets committed (`.env`, `.env.test` are gitignored)

## Project pointers

- Entry: `src/index.ts` → `src/server.ts` (`createServer`)
- Env (single source): `src/config/env.ts` (zod, fail-fast)
- Errors: `src/exceptions/*` with numeric `code`; mapped in `src/middlewares/ErrorHandler.ts`
- Architecture overview: `ARCHITECTURE.md`
