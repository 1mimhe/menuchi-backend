# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` (latest) | Yes |
| `dev` | Best-effort (pre-release) |
| Older tags | No |

## Reporting a vulnerability

Do **not** open a public issue for suspected vulnerabilities.

- Email the maintainer via the address in `package.json` (`author`), or
- Open a [private security advisory](https://github.com/1mimhe/menuchi-backend/security/advisories/new).

Include: affected endpoint/version, reproduction steps, impact. Expect an initial response within 72 hours.

## Security defaults in this repo

- Secrets only via environment (`.env` gitignored, validated by `src/config/env.ts`). Never commit `.env` / `.env.test`.
- CI secrets via `${{ secrets.* }}` (see `.github/workflows/ci.yml`).
- `helmet`, CORS allowlist (`MENUCHI_FRONT_URL`), rate limits on `/auth` and `/auth/send-otp`.
- Session cookies: `httpOnly`, `Secure` in production, `sameSite: lax`; `trust proxy: 1` for Docker/Nginx.
- OTP brute-force guard: max 5 attempts per email per 10 min.
- Docker runtime runs as non-root `app`; `HEALTHCHECK` hits `/health`.
- Prisma `P2002 → 409`, `P2025 → 404`; error responses never leak stacks (see `src/middlewares/ErrorHandler.ts`).
