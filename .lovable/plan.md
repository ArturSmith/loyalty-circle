# Rework subscription plans: Basic, Pro, Unlimited

## Decisions

- Three paid plans with your prices: **Basic 249 kr**, **Pro 349 kr**, **Unlimited 599 kr** (per month, excl. VAT)
- No permanent free tier — keep the 14-day free trial (trial grants Basic)
- Plan promises must match features that actually exist in the app — no POS/payment integrations, no REST API, no marketplace campaigns

## New lineup

```text
Basic — 249 kr/month
  1 location, 1 loyalty card, owner only
  Stamps & vouchers, QR scanning
  Basic analytics (per-card stats and activity)
  Discover/marketplace listing

Pro — 349 kr/month   [marked "Popular"]
  Up to 5 locations, up to 5 loyalty cards, up to 5 admins
  Everything in Basic
  Advanced analytics + CSV export
  Customer messaging and team chat
  Priority support

Unlimited — 599 kr/month
  Unlimited locations, unlimited loyalty cards, unlimited admins
  Everything in Pro
```

The 14-day trial grants Basic. Legacy paid subscriptions with no tier map to Pro (they keep what they paid for).

## What changes in code

1. **`src/lib/plans.ts`** — the single source of truth:
   - `PLAN_TIERS` becomes `["basic", "pro", "unlimited"]`; `TRIAL_TIER = "basic"`, `LEGACY_TIER = "pro"`.
   - New `PLANS` entries as above, with honest highlights.
   - Remove unused `FeatureKey`s: `integrations.*`, `marketplace.campaigns`, `marketplace.featured`, `wallet.apple` (Apple Wallet isn't built).
   - `planFromTier` maps old stored tiers: `starter` → basic, `growth` → pro, `scale` → unlimited — so existing subscribers land on the right plan without a data migration.
   - `smallestPlanFor` fallback updates to `PLANS.unlimited`.
   - Paddle price keys (Paddle IDs are permanent, so reuse, never mint new ones):
     - Basic → `business_monthly`
     - Pro → `business_growth_monthly`
     - Unlimited → `business_scale_monthly`
2. **Paddle catalogue (test environment)** — update all three prices in place via `create_price` with the same price IDs:
   - `business_monthly` → 249 NOK
   - `business_growth_monthly` → 349 NOK
   - `business_scale_monthly` → 599 NOK
   They sync to live automatically on the next publish.
3. **Screens that read plans** — pricing page, subscribe/paywall, billing settings, upgrade prompts — all render from `PLAN_LIST`, so they update automatically. Verify each shows the three new plans correctly (pricing page grid is `md:grid-cols-3`, works as-is).
4. **Webhook/tier mapping** — check `src/routes/api/public/payments/webhook.ts` maps each product/price to the new `plan_tier` values (`basic` / `pro` / `unlimited`) for new purchases.

## Notes

- Existing paying customers keep their Paddle billing until their subscription changes; their stored tier is remapped in code so nobody loses access.
- Price edits are one-line changes in `plans.ts` + a Paddle price update, should you want to tune them before launch.

## Ordering

1. Rewrite the plans section of `src/lib/plans.ts` (tiers, plans, features, tier mapping).
2. Update the three Paddle test prices with `create_price`.
3. Verify pricing page, subscribe flow, billing settings, and all `can(...)`/`check(...)` call sites typecheck and render.
4. Test checkout in the preview with the Paddle test card.
