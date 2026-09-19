#!/usr/bin/env bash
# Cold start smoke (AC-00, AC-36): bring the stack up from nothing, run the cold start tests
# against it, then take it down again.
#
# It runs under its own compose project name and its own ports, so that `npm run gate` never
# stops the stack a developer is using or deletes rows they edited by hand in pgweb.
set -euo pipefail

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-capacity-smoke}"
export API_PORT="${API_PORT:-3100}"
export WEB_PORT="${WEB_PORT:-8180}"
export DB_PORT="${DB_PORT:-55432}"
export KAFKA_PORT="${KAFKA_PORT:-19092}"
export STUDIO_PORT="${STUDIO_PORT:-15555}"

cleanup() {
  echo "smoke: stopping the ${COMPOSE_PROJECT_NAME} stack"
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "smoke: starting from a clean ${COMPOSE_PROJECT_NAME} stack"
docker compose down -v --remove-orphans >/dev/null 2>&1 || true

echo "smoke: docker compose up --wait"
SECONDS=0
docker compose up --wait --build
echo "smoke: the stack turned healthy in ${SECONDS}s"

API_BASE_URL="http://localhost:${API_PORT}" \
  WEB_BASE_URL="http://localhost:${WEB_PORT}" \
  npm run test:cold-start -w api
