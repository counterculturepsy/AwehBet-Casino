#!/usr/bin/env bash
# Two-session concurrency tests for the promotion workflow. Run by run_local.sh (hardened mode) against the
# disposable database after the full migration chain. Proves the submit version check runs under the same row
# lock as the state change: a competing session blocks, then sees the committed result.
set -uo pipefail
DB=${1:?usage: 30_promotion_concurrency.sh <database>}
ADMIN=c0c0c0c0-0000-4000-8000-0000000000a1; OWNER=c0c0c0c0-0000-4000-8000-0000000000a2
FAILS=0

q()  { psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$DB" "$@"; }
as() { local sub=$1; shift; q -c "set role authenticated; set request.jwt.claim.sub = '$sub'; $*"; }
# BusyBox date accepts %N but emits only seconds, so derive portable millisecond-scale values from epoch seconds.
# The waits are deliberately three seconds and assertions allow one second, making second precision sufficient.
ms() { echo $(( $(date +%s) * 1000 )); }
check() { if [ "$2" = 1 ]; then echo "PASS  $1"; else echo "FAIL  $1"; FAILS=$((FAILS + 1)); fi; }
ok() { if "$@"; then echo 1; else echo 0; fi; }
# Wait until the holder session is inside pg_sleep: its row lock is then held and its writes are uncommitted.
wait_for_holder() {
  for _ in $(seq 1 100); do
    [ "$(q -c "select count(*) from pg_stat_activity where wait_event = 'PgSleep' and datname = current_database()")" -ge 1 ] && return 0
    sleep 0.1
  done
  return 1
}

q -c "insert into auth.users(id,email) values ('$ADMIN','conc-admin@x.test'),('$OWNER','conc-owner@x.test');
      insert into private.admin_members(user_id,role) values ('$ADMIN','admin'),('$OWNER','owner');" || exit 1

# ---- Scenario 1: a concurrent edit commits while a submit with the old version waits on the row lock ------
ID1=$(as "$ADMIN" "select public.admin_create_promotion('Concurrent edit','Concurrency fixture','banner',0,gen_random_uuid(),null,null)")
as "$ADMIN" "select public.admin_update_promotion('$ID1', 1, 'Concurrent edit v2', 'Concurrency fixture', 'banner', 0, null, null); select pg_sleep(3);" >/dev/null 2>&1 &
HOLDER=$!
check "scenario 1: edit session holds the lock inside its transaction" "$(ok wait_for_holder)"
T0=$(ms)
OUT1=$(as "$ADMIN" "select public.admin_transition_promotion('$ID1','submit',1)" 2>&1); T1=$(ms)
wait "$HOLDER"
check "scenario 1: stale submit blocked on the row lock instead of racing it (waited $((T1 - T0)) ms)" "$(ok [ $((T1 - T0)) -ge 1000 ])"
check "scenario 1: stale submit failed with PS409 after the edit committed" "$(ok grep -q PS409 <<<"$OUT1")"
check "scenario 1: campaign is still a draft at version 2" "$(ok [ "$(q -c "select status || ':' || version from public.promotion_campaigns where id = '$ID1'")" = "draft:2" ])"
check "scenario 1: no submitted audit event was written" "$(ok [ "$(q -c "select count(*) from public.promotion_audit_events where campaign_id = '$ID1' and action = 'submitted'")" = 0 ])"

# ---- Scenario 2: two submits with the same current version; exactly one wins ----------------------------
ID2=$(as "$ADMIN" "select public.admin_create_promotion('Concurrent submit','Concurrency fixture','banner',0,gen_random_uuid(),null,null)")
as "$ADMIN" "select public.admin_transition_promotion('$ID2','submit',1); select pg_sleep(3);" >/dev/null 2>&1 &
HOLDER=$!
check "scenario 2: first submit holds the lock inside its transaction" "$(ok wait_for_holder)"
T0=$(ms)
OUT2=$(as "$ADMIN" "select public.admin_transition_promotion('$ID2','submit',1)" 2>&1); T1=$(ms)
wait "$HOLDER"
check "scenario 2: second submit blocked on the row lock (waited $((T1 - T0)) ms)" "$(ok [ $((T1 - T0)) -ge 1000 ])"
check "scenario 2: second submit was refused after the first committed" "$(ok grep -q 'ERROR' <<<"$OUT2")"
check "scenario 2: campaign is submitted at version 2" "$(ok [ "$(q -c "select status || ':' || version from public.promotion_campaigns where id = '$ID2'")" = "submitted:2" ])"
check "scenario 2: exactly one submitted audit event exists" "$(ok [ "$(q -c "select count(*) from public.promotion_audit_events where campaign_id = '$ID2' and action = 'submitted'")" = 1 ])"

# ---- Scenario 3: two approvals naming the same version; exactly one wins ---------------------------------
ID3=$(as "$ADMIN" "select public.admin_create_promotion('Concurrent review','Concurrency fixture','banner',0,gen_random_uuid(),null,null)")
as "$ADMIN" "select public.admin_transition_promotion('$ID3','submit',1)" >/dev/null 2>&1
as "$OWNER" "select public.admin_transition_promotion('$ID3','approve',2); select pg_sleep(3);" >/dev/null 2>&1 &
HOLDER=$!
check "scenario 3: first approval holds the lock inside its transaction" "$(ok wait_for_holder)"
T0=$(ms)
OUT3=$(as "$OWNER" "select public.admin_transition_promotion('$ID3','approve',2)" 2>&1); T1=$(ms)
wait "$HOLDER"
check "scenario 3: second approval blocked on the row lock (waited $((T1 - T0)) ms)" "$(ok [ $((T1 - T0)) -ge 1000 ])"
check "scenario 3: second approval naming the same version is refused after the first commits" "$(ok grep -q 'ERROR' <<<"$OUT3")"
check "scenario 3: exactly one approved audit event exists" "$(ok [ "$(q -c "select count(*) from public.promotion_audit_events where campaign_id = '$ID3' and action = 'approved'")" = 1 ])"

if [ "$FAILS" -ne 0 ]; then echo "CONCURRENCY TESTS FAILED ($FAILS)"; exit 1; fi
echo "CONCURRENCY TESTS PASSED"
