# Onboarding regression test

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
