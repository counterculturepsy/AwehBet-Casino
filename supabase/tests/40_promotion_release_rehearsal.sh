#!/usr/bin/env bash
# Release rehearsal for the promotion schema/app compatibility window, in a disposable database that holds the
# ORIGINAL shared schema plus the rows from 15_promotion_upgrade_seed.sql (run_local.sh rehearsal mode).
# Exercises: freeze while a writer is in flight, migration under freeze, frozen verification, unfreeze,
# legacy-app recovery drill and roll-forward. Never run against a real database.
set -uo pipefail
DB=${1:?usage: 40_promotion_release_rehearsal.sh <database>}
D=$(cd "$(dirname "$0")/.." && pwd)
ADMIN=a0a0a0a0-0000-4000-8000-000000000001; OWNER=a0a0a0a0-0000-4000-8000-000000000002
DRAFT=b0b0b0b0-0000-4000-8000-000000000001; SUBMITTED=b0b0b0b0-0000-4000-8000-000000000002
FWD="$D/migrations/20261115120000_promotion_studio_workflow.sql"
AUTHENTICATOR="promotion_rehearsal_authenticator_$$"
FAILS=0
PERSISTENT_DEFAULT_SET=0

q()   { psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$DB" "$@"; }
as()  { local sub=$1; shift; q -c "set role authenticated; set request.jwt.claim.sub = '$sub'; $*"; }
postgrest_as() { local sub=$1; shift; psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U "$AUTHENTICATOR" -d "$DB" -c "set role authenticated; set request.jwt.claim.sub = '$sub'; $*"; }
runf() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
cleanup() {
  if [ "$PERSISTENT_DEFAULT_SET" = 1 ]; then runf -c "alter role postgres reset app.promotion_maintenance" >/dev/null 2>&1 || true; fi
  runf -c "drop role if exists $AUTHENTICATOR" >/dev/null 2>&1 || true
}
# The migration session is the only one allowed through the freeze: postgres role + this setting.
mig() { runf -c "set app.promotion_maintenance = 'on'" -f "$1"; }
# BusyBox date accepts %N but emits only seconds; second precision is sufficient for the three-second lock fixture.
ms()  { echo $(( $(date +%s) * 1000 )); }
yes() { if "$@"; then echo 1; else echo 0; fi; }
check() { if [ "$2" = 1 ]; then echo "PASS  $1"; else echo "FAIL  $1"; FAILS=$((FAILS + 1)); fi; }
counts() { q -c "select (select count(*) from public.promotion_campaigns) || '/' || (select count(*) from public.promotion_audit_events)"; }
has() { grep -q "$1" <<<"$2"; }
eq()  { [ "$1" = "$2" ]; }
listed() { as "$ADMIN" "select count(*) from public.admin_list_promotions()"; }
GATE_OUT=""; GATE_RC=0
gate() {
  GATE_OUT=$(runf -v expect="$1" -v freeze="$2" -v min_campaigns="$3" -v min_events="$4" -f "$D/ops/promotion_verification_gate.sql" 2>&1)
  GATE_RC=$?
}
# A negative case passes only for its exact expected gate condition, never for an unrelated SQL or connection error.
gate_refused() { [ "$GATE_RC" -ne 0 ] && grep -Fq "$1" <<<"$GATE_OUT"; }
freeze_refused() { [ "$FRZ_RC" -ne 0 ] && grep -Fq 'app.promotion_maintenance is set as a persistent role/database default' <<<"$FRZ_OUT"; }
holder_sleeping() { q -c "select count(*) from pg_stat_activity where wait_event = 'PgSleep' and datname = current_database()"; }

# Model PostgREST's login role so session_user is not postgres. Use a per-process role and remove it on every exit.
trap cleanup EXIT
runf -c "create role $AUTHENTICATOR login noinherit; grant authenticated to $AUTHENTICATOR" || exit 1

echo "== A. Baseline on the original schema"
check "baseline has the 3 seeded campaigns and 6 audit events" "$(yes eq "$(counts)" 3/6)"
check "legacy list RPC works before the window" "$(yes eq "$(listed)" 3)"

echo "== B. Freeze while a legacy-app write is in flight"
as "$ADMIN" "select public.admin_create_promotion('In flight at freeze','Started before the freeze','banner',0); select pg_sleep(3);" >/dev/null 2>&1 &
HOLDER=$!
for _ in $(seq 1 100); do [ "$(holder_sleeping)" -ge 1 ] && break; sleep 0.1; done
T0=$(ms); runf -f "$D/ops/promotion_write_freeze.sql" &
FREEZER=$!
sleep 0.7
R0=$(ms); READS=$(listed); R1=$(ms)
check "reads are not blocked while the freeze waits for the in-flight writer (read took $((R1 - R0)) ms, writer still running)" "$(yes [ $((R1 - R0)) -lt 1500 ])"
check "the read returned the committed rows" "$(yes eq "$READS" 3)"
wait "$FREEZER"; FREEZE_RC=$?; T1=$(ms)
wait "$HOLDER"
check "freeze script succeeded" "$(yes eq "$FREEZE_RC" 0)"
check "freeze waited for the in-flight writer instead of cutting it off (waited $((T1 - T0)) ms)" "$(yes [ $((T1 - T0)) -ge 1000 ])"
check "the in-flight write committed completely (campaign and audit event)" "$(yes eq "$(counts)" 4/7)"

echo "== C. Frozen on the original schema (old app + old schema)"
O1=$(as "$ADMIN" "select public.admin_create_promotion('Frozen create','Must not exist','banner',0)" 2>&1)
O2=$(as "$ADMIN" "select public.admin_transition_promotion('$DRAFT','submit')" 2>&1)
O2B=$(postgrest_as "$ADMIN" "set app.promotion_maintenance = 'on'; select public.admin_create_promotion('PostgREST bypass attempt','Must not exist','banner',0)" 2>&1)
check "legacy create is refused with PS503" "$(yes has PS503 "$O1")"
check "legacy submit is refused with PS503" "$(yes has PS503 "$O2")"
check "a PostgREST-style session cannot activate the maintenance bypass" "$(yes has PS503 "$O2B")"
check "refused writes changed nothing" "$(yes eq "$(counts)" 4/7)"
check "reads keep working during the freeze" "$(yes eq "$(listed)" 4)"

echo "== D. Migration applied under the freeze"
mig "$FWD"; MIG_RC=$?
check "forward migration applied through the bypass session" "$(yes eq "$MIG_RC" 0)"
check "data preserved: still 4 campaigns and 7 audit events" "$(yes eq "$(counts)" 4/7)"
O3=$(as "$ADMIN" "select public.admin_create_promotion('Frozen new create','x','banner',0,gen_random_uuid(),null,null)" 2>&1)
O4=$(as "$ADMIN" "select public.admin_transition_promotion('$DRAFT','submit',1)" 2>&1)
O5=$(as "$ADMIN" "select public.admin_update_promotion('$DRAFT',1,'Frozen edit','Created before the upgrade','banner',0,null,null)" 2>&1)
check "new create stays refused after the migration re-granted execute" "$(yes has PS503 "$O3")"
check "new submit stays refused after the migration" "$(yes has PS503 "$O4")"
check "new edit stays refused after the migration" "$(yes has PS503 "$O5")"
check "all new-schema writes were refused: counts unchanged" "$(yes eq "$(counts)" 4/7)"
check "reads work on the new schema while frozen (search)" "$(yes eq "$(as "$ADMIN" "select count(*) from public.admin_search_promotions()")" 4)"

echo "== E. Verification gate (read-only)"
gate new on 4 7; check "verification gate passes for the new schema while frozen" "$(yes eq "$GATE_RC" 0)"
gate legacy on 4 7; check "the gate is not vacuous: it fails when the legacy state is expected" "$(yes gate_refused 'gate: 8 promotion RPCs present, expected 9 for state legacy')"
gate new off 4 7; check "the gate fails when the freeze should be off but is installed" "$(yes gate_refused 'gate: 4 freeze triggers, expected 0 for freeze=off')"
gate new on 5 7; check "the gate fails when a campaign is missing against the baseline" "$(yes gate_refused 'gate: 4 campaigns, expected at least 5')"

echo "== F. Unfreeze, then the matrix on the live schema"
runf -f "$D/ops/promotion_write_unfreeze.sql"
check "freeze triggers are gone" "$(yes eq "$(q -c "select count(*) from pg_trigger where tgname like 'promotion_write_freeze%'")" 0)"
gate new off 4 7; check "gate passes for the new schema once unfrozen" "$(yes eq "$GATE_RC" 0)"
runf -f "$D/ops/promotion_write_unfreeze.sql"; check "unfreeze with no freeze installed is a harmless no-op" "$(yes eq $? 0)"
as "$ADMIN" "select public.admin_update_promotion('$DRAFT', 1, 'Legacy draft edited', 'Created before the upgrade', 'banner', 0, null, null)" >/dev/null
check "submit without a version is rejected (22023)" "$(yes has 22023 "$(as "$ADMIN" "select public.admin_transition_promotion('$DRAFT','submit')" 2>&1)")"
check "submit with an invalid version is rejected (22023)" "$(yes has 22023 "$(as "$ADMIN" "select public.admin_transition_promotion('$DRAFT','submit',0)" 2>&1)")"
check "submit with a stale version is rejected (PS409)" "$(yes has PS409 "$(as "$ADMIN" "select public.admin_transition_promotion('$DRAFT','submit',1)" 2>&1)")"
as "$ADMIN" "select public.admin_transition_promotion('$DRAFT','submit',2)" >/dev/null
check "submit with the current version succeeds" "$(yes eq "$(q -c "select status || ':' || version from public.promotion_campaigns where id = '$DRAFT'")" submitted:3)"
as "$OWNER" "select public.admin_transition_promotion('$SUBMITTED','approve')" >/dev/null
check "approve without a version still works" "$(yes eq "$(q -c "select status from public.promotion_campaigns where id = '$SUBMITTED'")" approved)"

echo "== G. Recovery drill: put the already-shared web app back on the upgraded schema"
runf -f "$D/ops/promotion_write_freeze.sql"
mig "$D/ops/promotion_m2_legacy_app_compat.sql"; COMPAT_RC=$?
check "legacy-app compatibility script applied under the freeze" "$(yes eq "$COMPAT_RC" 0)"
check "legacy create is still refused while frozen" "$(yes has PS503 "$(as "$ADMIN" "select public.admin_create_promotion('Frozen legacy','x','banner',0)" 2>&1)")"
runf -f "$D/ops/promotion_write_unfreeze.sql"
LEGACY_ID=$(as "$ADMIN" "select public.admin_create_promotion('Legacy app draft','Created by the shared app','banner',0)")
check "legacy 6-argument create works on the upgraded schema" "$(yes [ -n "$LEGACY_ID" ])"
as "$ADMIN" "select public.admin_transition_promotion('$LEGACY_ID','submit')" >/dev/null
check "legacy 2-argument submit works and still advances version" "$(yes eq "$(q -c "select status || ':' || version from public.promotion_campaigns where id = '$LEGACY_ID'")" submitted:2)"
check "legacy submit was audited at the new version" "$(yes eq "$(q -c "select count(*) from public.promotion_audit_events where campaign_id = '$LEGACY_ID' and action = 'submitted' and campaign_version = 2")" 1)"
check "3-argument transition is absent in the legacy state" "$(yes eq "$(q -c "select to_regprocedure('public.admin_transition_promotion(uuid,text,integer)') is null")" t)"
gate legacy off 4 7; check "post-recovery gate passes with the legacy shims although versions and counts moved on" "$(yes eq "$GATE_RC" 0)"
gate new off 4 7; check "the new-schema gate correctly fails in the legacy state" "$(yes gate_refused 'gate: 9 promotion RPCs present, expected 8 for state new')"

echo "== H. Roll forward again"
runf -f "$D/ops/promotion_write_freeze.sql"
mig "$FWD"; REFWD_RC=$?
check "forward migration re-applied over the legacy-compat state" "$(yes eq "$REFWD_RC" 0)"
runf -f "$D/ops/promotion_write_unfreeze.sql"
SHIMS=$(q -c "select to_regprocedure('public.admin_transition_promotion(uuid,text)') is null
  and to_regprocedure('public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz)') is null
  and to_regprocedure('public.admin_transition_promotion(uuid,text,integer)') is not null")
check "legacy shims are gone and the 3-argument transition is back" "$(yes eq "$SHIMS" t)"
NEW_ID=$(as "$ADMIN" "select public.admin_create_promotion('Rolled forward','New app draft','banner',0,gen_random_uuid(),null,null)")
as "$ADMIN" "select public.admin_transition_promotion('$NEW_ID','submit',1)" >/dev/null
check "new app flow works after rolling forward" "$(yes eq "$(q -c "select status || ':' || version from public.promotion_campaigns where id = '$NEW_ID'")" submitted:2)"
check "no seeded campaign was lost across the whole rehearsal" "$(yes eq "$(q -c "select count(*) from public.promotion_campaigns where id in ('b0b0b0b0-0000-4000-8000-000000000001','b0b0b0b0-0000-4000-8000-000000000002','b0b0b0b0-0000-4000-8000-000000000003')")" 3)"

gate new off 4 7; check "gate passes for the new schema after rolling forward" "$(yes eq "$GATE_RC" 0)"

echo "== I. A persistent bypass default is refused"
runf -c "alter role postgres set app.promotion_maintenance = 'on'"
PERSISTENT_DEFAULT_SET=1
FRZ_OUT=$(runf -f "$D/ops/promotion_write_freeze.sql" 2>&1); FRZ_RC=$?
check "freeze refuses to install while a persistent bypass default exists (and says why)" "$(yes freeze_refused)"
gate new off 4 7; check "the gate fails while a persistent bypass default exists" "$(yes gate_refused 'gate: app.promotion_maintenance is set as a persistent role/database default')"
runf -c "alter role postgres reset app.promotion_maintenance"
PERSISTENT_DEFAULT_SET=0
gate new off 4 7; check "gate passes again once the default is reset" "$(yes eq "$GATE_RC" 0)"
check "freeze is installable again after the reset" "$(yes eq "$(runf -f "$D/ops/promotion_write_freeze.sql" >/dev/null 2>&1; echo $?)" 0)"
runf -f "$D/ops/promotion_write_unfreeze.sql"

if [ "$FAILS" -ne 0 ]; then echo "RELEASE REHEARSAL FAILED ($FAILS)"; exit 1; fi
echo "RELEASE REHEARSAL PASSED"
