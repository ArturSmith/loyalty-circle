
# Stempel — Digital Loyalty Cards

A mobile-first web app where businesses create customizable digital stamp cards ("5 klipp -50%, 10 gratis") and customers collect stamps via QR scanning. Inspired by paper punch cards like Milano Frisør.

## Scope (V1)

Two roles in one app: **business** and **customer**. Auth is shared; a user becomes a business by creating a business profile.

### Customer flow
1. Scans a business's QR (deep link to `/b/:businessId`).
2. Signs in (email magic link + Google — one-tap).
3. Sees business's available card templates → picks one → "card instance" is created for them.
4. Card appears in their wallet (`/wallet`). Cards are swipeable (horizontal carousel).
5. Tapping a card flips it and shows a QR encoding the card-instance ID.
6. Business scans → a stamp is added. Customer's phone shows a stamp-drop animation + progress.
7. On reward steps (e.g. 5, 10), a celebratory animation + redeem action.

### Business flow
1. Sign up → create business (name, logo).
2. Dashboard: list of cards, stamps issued, unique customers, redemptions.
3. "Create card" wizard: title, total steps, per-step rewards, card shape (rounded/square/ticket), background color, accent color, logo, stamp icon.
4. Business's public QR → opens `/b/:businessId` picker.
5. In-app scanner (`/scan`) uses device camera to read customer card QR → posts a stamp.
6. Rate-limit: max 1 stamp per card per N minutes to prevent double-scans.

## Screens

**Public/shared**
- `/` — landing (marketing + "I'm a business" / "I have a card")
- `/auth` — magic link + Google
- `/b/:businessId` — public business page, list of card templates to claim

**Customer (`_authenticated`)**
- `/wallet` — swipeable card carousel; tap-to-flip QR
- `/wallet/:cardInstanceId` — detail (history of stamps)

**Business (`_authenticated/business`)**
- `/business` — dashboard (KPIs, cards list, business QR)
- `/business/cards/new` — wizard
- `/business/cards/:id/edit`
- `/business/scan` — camera scanner

## Data model (Lovable Cloud / Supabase)

```
profiles(id=auth.users.id, display_name, avatar_url)
businesses(id, owner_id→profiles, name, slug, logo_url, created_at)
business_members(business_id, user_id, role)  -- future multi-staff
card_templates(id, business_id, title, subtitle, total_steps,
               shape, bg_color, accent_color, text_color,
               stamp_icon, logo_url, rewards jsonb, active, created_at)
  -- rewards: [{step:5, label:"-50%"}, {step:10, label:"GRATIS"}]
card_instances(id, template_id, customer_id→profiles, stamps_count,
               completed_at, created_at)
stamps(id, card_instance_id, issued_by→profiles, business_id, created_at)
redemptions(id, card_instance_id, step, redeemed_at)
user_roles(user_id, role) -- 'business_owner' via has_role()
```

RLS:
- profiles: self read/update.
- businesses: owner full; public read for id/name/logo/slug.
- card_templates: owner CRUD; public read where active.
- card_instances: customer reads own; business owner reads instances of their templates.
- stamps: business owner inserts (with rate-limit check via RPC); customer reads own via instance.
- redemptions: business owner + owner-customer.

All tables get proper GRANTs + policies. Stamp insertion goes through a `SECURITY DEFINER` RPC `add_stamp(card_instance_id)` that verifies caller owns the business tied to the template.

## Tech

- TanStack Start + Query, `_authenticated` layout.
- Lovable Cloud (Supabase) for auth (magic link + Google via broker), DB, storage (logos).
- `@zxing/browser` for camera QR scanning; `qrcode` for rendering.
- Framer Motion for stamp-drop, card flip, swipe carousel, reward burst.
- `embla-carousel-react` (already ecosystem-friendly) for swipeable wallet.

## Design direction

Norwegian small-business paper aesthetic reinterpreted: warm off-white paper background, deep ink navy, ornamental dividers echoing the reference card, serif display (Fraunces) + clean sans (Inter) for UI. Cards render with subtle paper grain, embossed stamps, scissor/tool motif. Bold but not generic.

## Build order

1. Enable Lovable Cloud, add Google sign-in provider, migrations for all tables + RLS + `add_stamp` RPC.
2. Design system tokens (paper, ink, accents, ornaments) in `src/styles.css`; base components.
3. Auth: `/auth` route + `_authenticated` layout (managed).
4. Landing + role routing.
5. Business: create-business onboarding → dashboard → card wizard (multi-step) → business QR + scanner.
6. Customer: `/b/:businessId` claim → `/wallet` carousel → tap-to-flip QR.
7. Stamp RPC + rate limit + animations for stamp drop / reward step.
8. Analytics counts (COUNT queries per card).
9. Polish, empty states, error boundaries, SEO on public routes.

## Not in V1
- Push notifications
- Multi-staff scanning permissions UI (schema ready)
- Payments / paid plans
- Editing card after stamps issued beyond cosmetic fields
- Card expiry
