#!/usr/bin/env bash
# Cold start smoke (AC-00, AC-36): bring the stack up from nothing, run the cold start tests
# against it, then take it down again. Ports follow the same defaults as docker-compose.yml and
# can be moved, for example API_PORT=3010 npm run smoke.
set -euo pipefail

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-8080}"
export API_PORT WEB_PORT

cleanup() {
  echo "smoke: stopping the stack"
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "smoke: starting from a clean stack"
docker compose down -v --remove-orphans >/dev/null 2>&1 || true

echo "smoke: docker compose up --wait"
SECONDS=0
docker compose up --wait --build
echo "smoke: the stack turned healthy in ${SECONDS}s"

API_BASE_URL="http://localhost:${API_PORT}" \
  WEB_BASE_URL="http://localhost:${WEB_PORT}" \
  npm run test:cold-start -w api
