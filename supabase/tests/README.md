# Onboarding regression test

`stamp_without_cooldown.sql` uses the same disposable-database fixture to
reproduce the old 30-second delay, then verify rapid owner/admin stamps, legacy
RPCs, reward issuance, full-card rejection, business permissions and billing.
Apply `20260902200000_remove_stamp_cooldown.sql` to deploy the change. It removes
the cooldown trigger and obsolete single-argument `add_stamp` overload (the
defaulted environment argument still supports those calls). Stamp history is
preserved. The stamping RPC locks each card before reading/updating progress.

`business_onboarding_review.sql` is a standalone PostgreSQL regression test,
not a pgTAP test for `supabase test db`. Run it only in a fresh database in a
disposable local PostgreSQL cluster. Do not run the test fixture in a real
Supabase project: it creates a minimal mock auth/application schema and imports
the relevant existing migrations.

```sh
psql -h /path/to/temporary/socket -p 55439 -d onboarding_test -f supabase/tests/business_onboarding_review.sql
```

Checks cover authentication, required fields and first-card enforcement,
transaction rollback, duplicate retries/notifications, cross-business access,
rejection/edit/resubmission, separate card moderation, trial activation, and
pending-draft seat accounting. Subscription counts are stubbed to zero.

`approval_trials.sql` runs the onboarding checks and then reproduces a missed
approval trial with an INSERT-only trigger. Run it in its own fresh disposable
database using the same command above, replacing the test filename. It checks
repair at the original approval time, expired/consumed/legacy trial protection,
pending/rejected businesses, idempotence, unchanged moderation/notifications,
and subsequent approvals (one trial per account).

`onboarding_permissions.sql` also requires its own fresh disposable database.
It reproduces a revoked onboarding EXECUTE grant, applies the permission repair
twice, then verifies actual signed-in submission, anonymous denial, missing-uid
denial, cross-owner denial, and continued moderation of both business and card.

## Deployment

Apply `supabase/migrations/20260902150000_business_onboarding_review.sql` before
deploying the UI. This adds the atomic submission RPC and updates lifecycle
functions/triggers. It does not delete or backfill existing business/card data.

Business and card rows saved by this flow are private drafts with
`accepted_by_platform = false`, required by the existing moderation queue's
foreign keys. No business/card row is created while filling in the wizard.
Submitting creates the drafts and queues both for review in one transaction.
They are not published or operational until approved. New trials start when
the business is accepted; existing trials and approved businesses are unchanged.

Apply `20260902170000_repair_approval_trials.sql` afterwards to re-establish the
approval trigger and repair eligible approved businesses with missing trials.
The repair requires an accepted **creation** moderation record and no previous
trial recorded on the account or any of its businesses. It uses the original
approval timestamp, not the migration date. It never deletes records, restarts
existing trials, or clears the permanent consumed-trial ledger. It deliberately
does not guess dates for businesses without creation-approval history; those
require investigation before any manual correction.

`20260902190000_fix_onboarding_execute_privilege.sql` restores EXECUTE on the
onboarding RPC for `authenticated` only. Apply after the onboarding migration;
it changes no data or table policies and leaves anonymous callers blocked.
