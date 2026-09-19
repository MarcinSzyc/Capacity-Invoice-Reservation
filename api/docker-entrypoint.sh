#!/bin/sh
# ADR-0002: migrations run before the app listens, so a container never serves an older schema.
set -e

cd /app/api
npm run prisma:migrate
cd /app

exec "$@"
