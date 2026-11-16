# Promotion Studio M2 release plan

Release source: branch `feature/admin-command-centre-phase3-20261111`, based on `0cb22865e48c4d7bf26e7fa9f693bbead3dd5811` before the release-fix commit.

**Status: not approved or validated for a hosted environment.** The database procedures below have been exercised only in disposable local PostgreSQL 17 databases. No hosted Supabase migration, matching hosted web Preview, Production deployment, or hosted smoke test has occurred.

## 1. Compatibility boundary

The forward migration `supabase/migrations/20261115120000_promotion_studio_workflow.sql` replaces the legacy six-argument create RPC and two-argument transition RPC. The M2 web build calls the new idempotent create RPC and version-aware transition RPC. The supported pairs are therefore:

| Web release | Schema state | Compatibility |
|---|---|---|
| Shared legacy web release | Original schema | Compatible |
| M2 web release | `new` schema | Compatible |
| Shared legacy web release | `new` schema | Writes fail until the legacy compatibility script is applied |
| M2 web release | Original or `legacy` schema | Writes fail because the M2 signatures are absent |

Reverting only the web deployment after the forward migration does not restore compatibility. Recovery must install `supabase/ops/promotion_m2_legacy_app_compat.sql` while writes remain frozen, verify the `legacy` schema variant, deploy the matching legacy web release, and only then unfreeze.

## 2. Database connection and maintenance bypass

Use a dedicated, direct PostgreSQL connection or a session-mode pooler connection. Do not use the Supabase CLI migration fallback, dashboard SQL editor, transaction-mode pooler, or any path that reconnects between `-c` and `-f`. Load the exact environment's connection string into `DATABASE_URL` without printing or committing it.

Before the window, confirm the identity through the same connection path that will run the migration:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc "select session_user, current_user"
```

Both values must be `postgres`. The freeze bypass requires `session_user = 'postgres'`; logging in as another role and later using `SET ROLE postgres` is insufficient. Stop if the identity differs.

The only permitted bypass is session-scoped and exists for one `psql` process:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -c "set app.promotion_maintenance = 'on'" \
  -f supabase/migrations/20261115120000_promotion_studio_workflow.sql
```

`psql` executes `-c` and `-f` sequentially on the same connection. The session setting is established before the migration's `BEGIN`, remains active across that transaction (including the campaign backfill), and disappears when `psql` disconnects after the migration. Never use `ALTER ROLE ... SET`, `ALTER DATABASE ... SET`, or another persistent maintenance default. The freeze script and verification gate deliberately refuse to proceed if any persistent `app.promotion_maintenance` default exists.

After every migration or recovery command, the dedicated `psql` process must exit. Remove the connection value from the operator shell when the database work is complete:

```sh
unset DATABASE_URL
```

Do not leave an interactive database session carrying the bypass setting. No role/database reset command should be necessary because no persistent default is permitted.

## 3. Freeze behavior

`supabase/ops/promotion_write_freeze.sql` installs row and statement triggers on `public.promotion_campaigns` and `public.promotion_audit_events`. They reject INSERT, UPDATE, DELETE, and TRUNCATE with SQLSTATE `PS503` unless both the required database identity and session-only bypass are present.

- The freeze is table-level. Function grants created by the forward migration do not defeat it.
- An ordinary connection can set the custom GUC text, but cannot bypass because its `session_user` is not `postgres`. PostgREST uses an authenticator login role, so changing to an API role does not change `session_user` to `postgres`.
- Installing the triggers takes a `SHARE ROW EXCLUSIVE` table lock. Writers that already hold conflicting locks finish and commit or roll back before the freeze can become active. Once the trigger-creation transaction commits, later writes receive `PS503`.
- The freeze script uses a five-second `lock_timeout`. If it times out, its transaction rolls back and no partial freeze is installed. Retry only after confirming the blocker is an expected in-flight writer.
- Ordinary reads do not conflict with the trigger-creation lock, but PostgreSQL lock queues and the short lock-acquisition/commit interval can still cause temporary read waiting. Do not promise zero read latency during freeze or unfreeze.
- Unfreeze is idempotent when no freeze is installed. When triggers exist, dropping them takes table locks and may temporarily block reads and writes for up to the configured lock timeout; a timeout rolls the unfreeze transaction back.

## 4. Release sequence

Nothing in this section is authorization to change a hosted environment.

### Before the window

1. Validate the full database matrix and matching web build against an isolated hosted Preview. Hosted validation is currently outstanding.
2. Confirm a usable backup or point-in-time recovery position. Take a targeted data dump of `public.promotion_campaigns` and `public.promotion_audit_events` using a connection and storage location approved for that environment.
3. Record the baseline campaign count, audit-event count, installed promotion RPC signatures, deployed web release identifier, and current migration history. The counts become lower bounds for recovery-aware verification.
4. Confirm the direct/session-mode `postgres` connection described in section 2 and verify there is no persistent maintenance default:

   ```sh
   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
     "select count(*) from pg_db_role_setting s, unnest(s.setconfig) c where c like 'app.promotion\_maintenance=%'"
   ```

   The result must be `0`.
5. Announce the administrative write window and stop if the matching M2 web release is not ready to deploy.

### Window: dependency order

1. **Freeze writes.**

   ```sh
   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
     -f supabase/ops/promotion_write_freeze.sql
   ```

2. **Confirm the freeze and drain.** Before migration, directly confirm all four freeze triggers exist, a real administrative write receives `PS503`, and no promotion writer remains active. A writer that began before lock acquisition is allowed to finish consistently; account for any completed campaign and audit rows in the recorded lower bounds.
3. **Apply the forward migration through the same-session bypass.** Use exactly the command in section 2. It is transactional and refuses incompatible pre-existing column definitions.
4. **Apply the private-table RLS migration.**

   ```sh
   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
     -f supabase/migrations/20261115191853_private_table_rls.sql
   ```

   Independently verify RLS is enabled on all five named `private.*` tables. The promotion verification gate does not check this migration.
5. **Deploy the matching M2 web release while the freeze remains active.** Migration precedes web deployment because the M2 web release requires the new RPCs. Do not unfreeze between them.
6. **Run the `new` verification gate while frozen.**

   ```sh
   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
     -v expect=new -v freeze=on \
     -v min_campaigns="$BASELINE_CAMPAIGNS" -v min_events="$BASELINE_EVENTS" \
     -f supabase/ops/promotion_verification_gate.sql
   ```

7. **Perform hosted web checks while still frozen.** Confirm the intended deployment is serving, owner/viewer reads use the new schema, runtime logs show no new release errors, and a controlled administrative write is refused with the expected maintenance response. These are hosted checks outside the SQL gate.
8. **Unfreeze only after both SQL and hosted checks pass.**

   ```sh
   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
     -f supabase/ops/promotion_write_unfreeze.sql
   ```

9. **Verify the open state and watch it.** Re-run the gate with `expect=new` and `freeze=off`, then monitor errors, stale-version conflicts, and failed submits. Refresh administrator tabs opened before the release.

## 5. Verification gate contract

`supabase/ops/promotion_verification_gate.sql` accepts four required `psql` variables:

- `expect=new`: requires the M2 create/update RPCs, the three-argument versioned transition, exactly eight promotion RPC overloads, and no legacy create/transition shims.
- `expect=legacy`: requires the M2 create/update RPCs plus the two legacy shims, exactly nine promotion RPC overloads, and no three-argument transition.
- `freeze=on|off`: requires exactly four or zero promotion freeze triggers, respectively.
- `min_campaigns` and `min_events`: lower bounds recorded before the window. They deliberately permit legitimate writes completed before freeze acquisition and recovery drill writes. They do not assume campaign versions reset or row counts remain equal after recovery.

For both variants, the gate checks:

- campaign and audit-event counts are at least the supplied lower bounds;
- every campaign has `version >= 1` and a non-null idempotency key;
- the expected RPC count and signatures are present;
- each promotion RPC pins an empty `search_path`;
- RPCs are SECURITY DEFINER except for the deliberate SECURITY INVOKER legacy create forwarder;
- `anon` and `PUBLIC` lack execute while `authenticated` has execute;
- the requested freeze-trigger count is present; and
- no persistent maintenance-bypass default exists.

The gate does **not** prove HTTP behavior, web-release identity, application authorization journeys, RLS on the five private player tables, data-field equality, absence of all active writers, performance, backup validity, or hosted readiness. Those require their separate checks.

## 6. Recovery

Keep the freeze installed throughout recovery. A web rollback alone is insufficient.

| Situation | Action |
|---|---|
| Freeze installation times out | Its transaction changed nothing. Inspect the blocker and retry. |
| Forward migration fails | Its transaction rolls back. Reconcile the reported incompatibility or abort and unfreeze the unchanged schema. |
| M2 web release is bad | Prefer a fixed M2 release while frozen. |
| Legacy web release must return | Apply the legacy compatibility script through a dedicated same-session bypass, run the `legacy/on` gate, deploy the matching legacy web release, perform hosted checks, then unfreeze and run `legacy/off`. |
| Roll forward after legacy recovery | Freeze, reapply the forward migration through the same-session bypass, run `new/on`, deploy the M2 web release, verify, unfreeze, and run `new/off`. |
| Promotion data is damaged | Restore only the scoped promotion data under an approved recovery plan. Whole-database recovery can discard unrelated writes and requires separate authorization. |
| Unfreeze times out | The transaction rolls back. Inspect blockers and safely re-run the idempotent script. |

Legacy recovery command:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -c "set app.promotion_maintenance = 'on'" \
  -f supabase/ops/promotion_m2_legacy_app_compat.sql
```

Post-recovery verification uses lower bounds and accepts campaign versions greater than one; it does not assume the migration or compatibility shim resets versions.

## 7. Local evidence and hosted blockers

Fresh local results from a disposable `postgres:17-alpine` container, with no published ports, tmpfs database storage, and read-only repository/Git mounts:

| Mode | Final local result |
|---|---|
| `hardened` | Passed: 17 general security rows, 140 promotion rows, and 14 concurrency assertions (171 total assertions) |
| `upgrade` | Passed: 21 upgrade rows, 17 general security rows, and 140 promotion rows (178 total) |
| `m2-applied` | Passed: 17 general security rows and 140 promotion rows (157 total) |
| `incompatible` | Passed: incompatible column definition refused and transaction left no partial changes |
| `rls` | Passed: repository-chain gap reproduced, all five private tables enabled, and reapplication was a no-op |
| `rehearsal` | Passed: 48 release/recovery assertions, including the PostgREST-style bypass refusal and exact negative-gate messages |
| `baseline` | Expected failure only: six unhardened security checks failed; the runner stopped at the security-suite failure, with no unexpected failure |

These results are local database evidence only. No TypeScript/application inputs changed in this release-fix set, so the application test suite was not rerun. They do not replace the hosted checks below.

Hosted validation remains blocked because:

- no isolated Supabase Preview branch has been provided or approved;
- the visible shared Development migration history does not match the repository migration filenames, so its migration procedure must be established before any hosted application;
- no Production Supabase identity has been established;
- the matching branch has not been pushed and no matching hosted web Preview has been verified;
- Vercel project/team access and the target project identity have not been established; and
- no hosted backup, direct migration connection, deployment approval, or release window has been authorized.

Do not use the shared Development database to substitute for the missing isolated hosted validation.
