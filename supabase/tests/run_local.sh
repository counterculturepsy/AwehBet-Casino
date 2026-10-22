#!/usr/bin/env bash
# Usage: run_local.sh [baseline|hardened]  (needs a local Postgres on $PGHOST/$PGPORT; throwaway DB only)
set -euo pipefail
MODE=${1:-hardened}; D=$(cd "$(dirname "$0")/.." && pwd); DB=awehbet_sec_test_$MODE
psql -v ON_ERROR_STOP=1 -qc "drop database if exists $DB" postgres; psql -v ON_ERROR_STOP=1 -qc "create database $DB" postgres
P="psql -v ON_ERROR_STOP=1 -q -d $DB"
$P -f "$D/tests/00_supabase_stub.sql"; $P -f "$D/migrations/20261016140000_player_accounts.sql"; $P -f "$D/migrations/20261016190000_admin_access.sql"
[ "$MODE" = hardened ] && $P -f "$D/migrations/20261022170000_security_hardening.sql"
$P -f "$D/tests/10_security_tests.sql"
