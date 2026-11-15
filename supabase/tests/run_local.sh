#!/usr/bin/env bash
# Usage: run_local.sh [baseline|hardened|upgrade|m2-applied|incompatible]
#   (needs a local Postgres on $PGHOST/$PGPORT; throwaway DB only)
#   baseline | hardened  fresh chain: every migration in order, then all tests (baseline skips the hardening migration);
#                        hardened also runs the two-session concurrency tests
#   upgrade              original shared promotion migration + seeded rows -> forward migration -> upgrade checks
#                        -> forward migration re-applied -> all tests
#   m2-applied           database that applied the earlier in-place M2 edit of the shared migration (commit 5ea3ea6)
#                        -> forward migration -> all tests
#   incompatible         the forward migration must refuse a conflicting pre-existing column and change nothing
set -euo pipefail
MODE=${1:-hardened}; D=$(cd "$(dirname "$0")/.." && pwd); DB=awehbet_sec_test_${MODE//-/_}
ORIG="$D/migrations/20261111030000_promotion_workflow.sql"; FWD="$D/migrations/20261115120000_promotion_studio_workflow.sql"
psql -v ON_ERROR_STOP=1 -qc "drop database if exists $DB" postgres; psql -v ON_ERROR_STOP=1 -qc "create database $DB" postgres
P="psql -v ON_ERROR_STOP=1 -q -d $DB"
$P -f "$D/tests/00_supabase_stub.sql"; $P -f "$D/migrations/20261016140000_player_accounts.sql"; $P -f "$D/migrations/20261016190000_admin_access.sql"
if [ "$MODE" != baseline ]; then $P -f "$D/migrations/20261022170000_security_hardening.sql"; fi

case "$MODE" in
  baseline|hardened)
    $P -f "$ORIG"; $P -f "$FWD" ;;
  upgrade)
    $P -f "$ORIG"; $P -f "$D/tests/15_promotion_upgrade_seed.sql"
    $P -f "$FWD"; $P -f "$D/tests/25_promotion_upgrade_checks.sql"
    $P -f "$FWD" ;;  # re-applying must be a no-op for an already upgraded schema
  m2-applied)
    git -C "$D" show 5ea3ea6:supabase/migrations/20261111030000_promotion_workflow.sql | $P -f -
    $P -f "$FWD" ;;
  incompatible)
    $P -f "$ORIG"
    $P -c "alter table public.promotion_campaigns add column version bigint not null default 1"
    if out=$($P -f "$FWD" 2>&1); then echo "FAIL: forward migration accepted an incompatible version column" >&2; exit 1; fi
    echo "$out" | grep -q "incompatible definition" || { echo "FAIL: unexpected error: $out" >&2; exit 1; }
    left=$($P -Atc "select count(*) from information_schema.columns where table_name = 'promotion_campaigns' and column_name = 'idempotency_key'")
    [ "$left" = 0 ] || { echo "FAIL: the refused migration left partial changes behind" >&2; exit 1; }
    echo "PASS: incompatible schema refused and nothing was changed"; exit 0 ;;
  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac

$P -f "$D/tests/10_security_tests.sql"
$P -f "$D/tests/20_promotion_security_tests.sql"
if [ "$MODE" = hardened ]; then bash "$D/tests/30_promotion_concurrency.sh" "$DB"; fi
