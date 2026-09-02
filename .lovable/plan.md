# Rework subscription plans: Basic + Pro

## Decision (from your answers)

- Two paid plans: **Basic** and **Pro**
- Prices set by me, based on the features that actually exist in the app
- No permanent free tier — keep the 14-day free trial (trial grants Basic)

## Why the current plans feel wrong

The current lineup (Starter 499 / Growth 899 / Scale 1499 kr) sells things the app does not have: POS and payment integrations, a REST API, marketplace campaigns, featured placement. The plan promises must match reality, and the price must match a small-business loyalty tool, not an enterprise suite.

## New lineup

```text
Basic — 199 kr/month (excl. VAT)
  1 location, 1 loyalty card, owner only
  Stamps & vouchers, QR scanning
  Basic analytics (per-card stats and activity)
  Discover/marketplace listing

Pro — 499 kr/month (excl. VAT)   [marked "Popular"]
  Up to 5 locations, unlimited loyalty cards, up to 5 admins
  Everything in Basic
  Advanced analytics + CSV export
  Customer messaging and team chat
  Priority support
```

The 14-day trial grants Basic. Legacy paid subscriptions with no tier map to Pro (they keep what they paid for).

## What changes in code

1. **`src/lib/plans.ts`** — the single source of truth:
   - `PLAN_TIERS` becomes `["basic", "pro"]`; `TRIAL_TIER = "basic"`, `LEGACY_TIER = "pro"`.
   - New `PLANS` entries as above, with honest highlights (no integrations/API/campaigns).
   - Remove unused `FeatureKey`s: `integrations.*`, `marketplace.campaigns`, `marketplace.featured`, `wallet.apple` (Apple Wallet isn't built; `wallet.google` stays only if referenced — otherwise cleaned up too).
   - `planFromTier` maps old stored tiers `starter` → basic, `growth`/`scale` → pro, so existing subscribers in the database land on the right plan without a data migration.
   - Paddle price keys: Basic reuses `business_monthly`, Pro reuses `business_growth_monthly` (per the Paddle rule that IDs are permanent — never mint new IDs for the same logical product). `business_scale_monthly` is simply no longer referenced.
2. **Paddle catalogue (sandbox)** — update the two prices in place:
   - `create_price` with id `business_monthly` → 19900 NOK öre... (199 NOK) replacing the old amount.
   - `create_price` with id `business_growth_monthly` → 499 NOK.
   - The Scale price stays in Paddle but is unlinked from the app; nothing breaks.
3. **Screens that read plans** — pricing page, subscribe/paywall, billing settings, upgrade prompts in the wizard — all render from `PLAN_LIST`, so they update automatically. Verify each one shows the two new plans correctly.
4. **Webhook/tier mapping** — check `src/routes/api/public/payments/webhook.ts` maps the product/price to `plan_tier` `basic`/`pro` correctly for new purchases.

## Notes

- Prices change only in Paddle **test**; they sync to live on the next publish.
- Existing paying customers: their stored `plan_tier` is remapped in code (`starter`→basic, `growth`/`scale`→pro), so nobody loses access or gets double-charged. If any real customer is on Scale, Paddle keeps billing the old amount until their subscription changes — we can migrate them manually if that ever happens.
- If you want different price points (e.g. 149/399), that's a one-line change per plan before publishing.

## Ordering

1. Rewrite `src/lib/plans.ts` (tiers, plans, features, tier mapping).
2. Update the two Paddle sandbox prices with `create_price`.
3. Verify pricing page, subscribe flow, billing settings, and any `can("...")`/`check(...)` call sites still typecheck and render.
4. Test checkout in the preview with the test card.
