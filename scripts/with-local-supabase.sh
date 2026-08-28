#!/usr/bin/env bash
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "A Docker-compatible runtime is required. Start Colima with: colima start" >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "The local Supabase stack is not running. Start it with: npm run db:local:start" >&2
  exit 1
fi

eval "$(supabase status -o env)"
export NEXT_PUBLIC_SUPABASE_URL="${API_URL}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY}}"
export SUPABASE_SECRET_KEY="${SECRET_KEY:-${SERVICE_ROLE_KEY}}"
export LOCAL_AUTH_BYPASS=true
export MOCK_PROVIDERS=false

exec "$@"
