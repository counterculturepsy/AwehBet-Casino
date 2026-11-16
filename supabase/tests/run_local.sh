#!/usr/bin/env bash
# Usage: run_local.sh [baseline|hardened|upgrade|m2-applied|incompatible|rls|rehearsal]
#   (needs a local Postgres on $PGHOST/$PGPORT; throwaway DB only)
#   baseline | hardened  fresh chain: every migration in order, then all tests (baseline skips the hardening migration);
#                        hardened also runs the two-session concurrency tests
#   upgrade              original shared promotion migration + seeded rows -> forward migration -> upgrade checks
#                        -> forward migration re-applied -> all tests
#   m2-applied           database that applied the earlier in-place M2 edit of the shared migration (commit 5ea3ea6)
#                        -> forward migration -> all tests
#   rehearsal            release rehearsal on the original schema + seed: write freeze with an in-flight writer, migration
#                        under freeze, verification, unfreeze, legacy-app recovery drill, roll-forward (ops/*.sql)
#   rls                  the repository chain leaves the five private.* player tables without RLS; the RLS migration
#                        closes that and is idempotent
#   incompatible         the forward migration must refuse a conflicting pre-existing column and change nothing
set -euo pipefail
MODE=${1:-hardened}; D=$(cd "$(dirname "$0")/.." && pwd); DB=awehbet_sec_test_${MODE//-/_}
ORIG="$D/migrations/20261111030000_promotion_workflow.sql"; FWD="$D/migrations/20261115120000_promotion_studio_workflow.sql"
RLS="$D/migrations/20261115191853_private_table_rls.sql"
ADMIN_RO="$D/migrations/20261116090000_admin_readonly_views.sql"
psql -X -v ON_ERROR_STOP=1 -qc "drop database if exists $DB" postgres; psql -X -v ON_ERROR_STOP=1 -qc "create database $DB" postgres
P="psql -X -v ON_ERROR_STOP=1 -q -d $DB"
$P -f "$D/tests/00_supabase_stub.sql"; $P -f "$D/migrations/20261016140000_player_accounts.sql"; $P -f "$D/migrations/20261016190000_admin_access.sql"
if [ "$MODE" != baseline ]; then $P -f "$D/migrations/20261022170000_security_hardening.sql"; fi

case "$MODE" in
  baseline|hardened)
    $P -f "$ORIG"; $P -f "$FWD"; $P -f "$RLS" ;;
  upgrade)
    $P -f "$ORIG"; $P -f "$D/tests/15_promotion_upgrade_seed.sql"
    $P -f "$FWD"; $P -f "$D/tests/25_promotion_upgrade_checks.sql"
    $P -f "$FWD"; $P -f "$RLS" ;;  # re-applying must be a no-op for an already upgraded schema
  rls)
    # The repository chain alone must reproduce the gap, the migration must close it, and re-running it must be a
    # no-op (Development already has RLS on these tables through a migration recorded only there).
    RLS_COUNT="select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'private' and c.relname in ('player_identities','payout_accounts','kyc_reviews','audit_events','rate_limit_buckets') and c.relrowsecurity"
    before=$($P -Atc "$RLS_COUNT")
    [ "$before" = 0 ] || { echo "FAIL: expected the repository chain to leave these tables without RLS, found $before with RLS" >&2; exit 1; }
    $P -f "$RLS"; $P -f "$RLS"
    after=$($P -Atc "$RLS_COUNT")
    [ "$after" = 5 ] || { echo "FAIL: expected RLS on 5 private tables after the migration, found $after" >&2; exit 1; }
    echo "PASS: RLS gap reproduced from the repository chain, closed by the migration, and re-applying is a no-op"; exit 0 ;;
  rehearsal)
    $P -f "$ORIG"; $P -f "$D/tests/15_promotion_upgrade_seed.sql"
    bash "$D/tests/40_promotion_release_rehearsal.sh" "$DB"; exit $? ;;
  m2-applied)
    git -C "$D" show 5ea3ea6:supabase/migrations/20261111030000_promotion_workflow.sql | $P -f -
    $P -f "$FWD"; $P -f "$RLS" ;;
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

# Read-only admin functions: applied twice to prove the migration is idempotent.
$P -f "$ADMIN_RO"; $P -f "$ADMIN_RO"
$P -f "$D/tests/10_security_tests.sql"
$P -f "$D/tests/20_promotion_security_tests.sql"
$P -f "$D/tests/50_admin_readonly_tests.sql"
if [ "$MODE" = hardened ]; then bash "$D/tests/30_promotion_concurrency.sh" "$DB"; fi
