#!/bin/bash
set -e

# Dev-oriented startup: sync the schema, retrying while Postgres comes up
# (compose also gates on the psql healthcheck; this covers the remaining
# race). Production should switch to `prisma migrate deploy` once real
# migrations exist (see src/db/schema.prisma).
for i in $(seq 1 30); do
  if npx prisma db push --schema=./src/db/schema.prisma --accept-data-loss --skip-generate; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "entrypoint: database never became ready" >&2
    exit 1
  fi
  echo "entrypoint: waiting for database... ($i/30)"
  sleep 2
done

exec "$@"
