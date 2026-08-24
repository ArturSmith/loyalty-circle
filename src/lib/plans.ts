/**
 * Subscription plans and entitlements — the single source of truth.
 *
 * Every limit in the product is declared here and nowhere else. Screens must
 * never test `plan === "growth"`; they ask the entitlement system a question
 * ("how many locations may I have?", "can I use integrations?") and render the
 * answer. Adding a plan or a feature means editing this file only.
 */

/* -------------------------------------------------------------- plan tiers */

export const PLAN_TIERS = ["starter", "growth", "scale"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * What a paying subscription grants when it predates tiered pricing and so has
 * no `plan_tier`. These customers bought "unlimited everything", so downgrading
 * them silently would take away features they already paid for.
 */
export const LEGACY_TIER: PlanTier = "growth";

/**
 * What the 14-day free trial grants. The trial is a taste of the entry plan,
 * not of the whole product — otherwise the trial ending feels like a downgrade
 * and there is nothing left to sell.
 */
export const TRIAL_TIER: PlanTier = "starter";

/* ----------------------------------------------------------------- limits */

/** A numeric cap. `null` means unlimited — never use a magic number like 9999. */
export type Limit = number | null;

export type FeatureKey =
  | "analytics.basic"
  | "analytics.advanced"
  | "analytics.export"
  | "integrations.pos"
  | "integrations.payments"
  | "integrations.api"
  | "marketplace.listing"
  | "marketplace.featured"
  | "marketplace.campaigns"
  | "wallet.apple"
  | "wallet.google"
  | "support.priority";

export type PlanLimits = {
  locations: Limit;
  loyaltyCards: Limit;
  administrators: Limit;
};

/** ISO 4217 code for every price in this file. */
export const PLAN_CURRENCY = "NOK";

/** Formats a plan price for display, e.g. "499 kr". */
export function formatPlanPrice(price: number): string {
  return `${new Intl.NumberFormat("nb-NO").format(price)} kr`;
}

export type Plan = {
  tier: PlanTier;
  name: string;
  /** Monthly price in NOK, excluding VAT. */
  price: number;
  /**
   * Paddle price `external_id`. A price with exactly this id must exist in both
   * the sandbox and live Paddle catalogues, or checkout for this tier fails
   * with "Price not found".
   */
  paddlePriceKey: string;
  tagline: string;
  /** Shown as the one-line reason to pick this tier over the previous one. */
  bestFor: string;
  limits: PlanLimits;
  features: readonly FeatureKey[];
  /** Marketing bullets for the pricing page, in display order. */
  highlights: readonly string[];
  popular?: boolean;
};

/* ------------------------------------------------------------------ plans */

export const PLANS: Record<PlanTier, Plan> = {
  starter: {
    tier: "starter",
    name: "Starter",
    price: 499,
    // Reuses the original single-tier price so existing checkout keeps working.
    paddlePriceKey: "business_monthly",
    tagline: "One shop, one card, no fuss.",
    bestFor: "A single location finding its regulars.",
    limits: { locations: 1, loyaltyCards: 1, administrators: 1 },
    features: ["analytics.basic", "marketplace.listing", "wallet.google", "wallet.apple"],
    highlights: [
      "1 location",
      "1 loyalty card",
      "Owner access only",
      "Apple & Google Wallet passes",
      "Basic analytics",
      "Marketplace listing",
    ],
  },
  growth: {
    tier: "growth",
    name: "Growth",
    price: 899,
    paddlePriceKey: "business_growth_monthly",
    tagline: "Several locations, a real team.",
    bestFor: "Businesses with more than one door and more than one manager.",
    limits: { locations: 5, loyaltyCards: 5, administrators: 5 },
    features: [
      "analytics.basic",
      "analytics.advanced",
      "analytics.export",
      "integrations.pos",
      "integrations.payments",
      "marketplace.listing",
      "marketplace.featured",
      "wallet.google",
      "wallet.apple",
      "support.priority",
    ],
    highlights: [
      "Up to 5 locations",
      "Up to 5 loyalty cards",
      "Up to 5 administrators",
      "Advanced analytics + CSV export",
      "POS & payment integrations",
      "Featured marketplace placement",
      "Priority support",
    ],
    popular: true,
  },
  scale: {
    tier: "scale",
    name: "Scale",
    price: 1499,
    paddlePriceKey: "business_scale_monthly",
    tagline: "Chains, franchises, and everything after.",
    bestFor: "Multi-site operators who need no ceiling and an API.",
    limits: { locations: null, loyaltyCards: null, administrators: null },
    features: [
      "analytics.basic",
      "analytics.advanced",
      "analytics.export",
      "integrations.pos",
      "integrations.payments",
      "integrations.api",
      "marketplace.listing",
      "marketplace.featured",
      "marketplace.campaigns",
      "wallet.google",
      "wallet.apple",
      "support.priority",
    ],
    highlights: [
      "Unlimited locations",
      "Unlimited loyalty cards",
      "Unlimited administrators",
      "Full analytics suite",
      "All integrations + REST API",
      "Marketplace campaigns",
      "Priority support",
    ],
  },
};

export const PLAN_LIST: readonly Plan[] = PLAN_TIERS.map((t) => PLANS[t]);

export function planFromTier(tier: string | null | undefined): Plan {
  if (tier && (PLAN_TIERS as readonly string[]).includes(tier)) {
    return PLANS[tier as PlanTier];
  }
  return PLANS[LEGACY_TIER];
}

/** Where a business's entitlements come from. */
export type BillingState =
  /** Paying customer — the tier on their subscription applies. */
  | { kind: "subscribed"; tier: string | null }
  /** Inside the 14-day free trial, with no subscription yet. */
  | { kind: "trialing" }
  /** Trial is over and nothing was purchased. */
  | { kind: "expired" };

/**
 * Resolves the plan actually in force.
 *
 * A trial grants the entry plan. A legacy paid subscription (no `plan_tier`)
 * keeps LEGACY_TIER so existing customers never lose paid features. An expired
 * trial still resolves to the entry plan for display purposes — access itself
 * is gated separately by useBusinessAccess, not by entitlements.
 */
export function planForBillingState(state: BillingState): Plan {
  if (state.kind === "subscribed") return planFromTier(state.tier);
  return PLANS[TRIAL_TIER];
}

/* ----------------------------------------------------------- entitlements */

export type LimitKey = keyof PlanLimits;

export type UsageCounts = Partial<Record<LimitKey, number>>;

export type LimitCheck = {
  allowed: boolean;
  limit: Limit;
  used: number;
  /** Remaining slots, or null when unlimited. */
  remaining: Limit;
  /** Human-readable reason when `allowed` is false. */
  reason: string | null;
};

export type Entitlements = {
  plan: Plan;
  /** True while the business is on the free trial rather than a paid plan. */
  isTrial: boolean;
  can: (feature: FeatureKey) => boolean;
  limitOf: (key: LimitKey) => Limit;
  /** Whether one more of `key` may be created, given current usage. */
  checkLimit: (key: LimitKey, used: number) => LimitCheck;
  /** The cheapest plan that includes `feature`, or null if none does. */
  upgradeFor: (feature: FeatureKey) => Plan | null;
};

const LIMIT_LABELS: Record<LimitKey, { one: string; many: string }> = {
  locations: { one: "location", many: "locations" },
  loyaltyCards: { one: "loyalty card", many: "loyalty cards" },
  administrators: { one: "administrator", many: "administrators" },
};

export function entitlementsFor(state: BillingState): Entitlements {
  const plan = planForBillingState(state);
  const isTrial = state.kind !== "subscribed";

  const can = (feature: FeatureKey) => plan.features.includes(feature);
  const limitOf = (key: LimitKey) => plan.limits[key];

  const checkLimit = (key: LimitKey, used: number): LimitCheck => {
    const limit = plan.limits[key];
    if (limit === null) {
      return { allowed: true, limit: null, used, remaining: null, reason: null };
    }
    const allowed = used < limit;
    const label = limit === 1 ? LIMIT_LABELS[key].one : LIMIT_LABELS[key].many;
    return {
      allowed,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      reason: allowed
        ? null
        : isTrial
          ? `Your free trial includes ${limit} ${label}. Choose a plan to add more.`
          : `Your ${plan.name} plan includes ${limit} ${label}. Upgrade to add more.`,
    };
  };

  const upgradeFor = (feature: FeatureKey): Plan | null =>
    PLAN_LIST.find((p) => p.features.includes(feature)) ?? null;

  return { plan, isTrial, can, limitOf, checkLimit, upgradeFor };
}

/** The cheapest plan that satisfies a set of limits — used by the wizard's review step. */
export function smallestPlanFor(usage: UsageCounts): Plan {
  const fits = (p: Plan) =>
    (Object.keys(usage) as LimitKey[]).every((k) => {
      const limit = p.limits[k];
      return limit === null || (usage[k] ?? 0) <= limit;
    });
  return PLAN_LIST.find(fits) ?? PLANS.scale;
}

/* ------------------------------------------------------------ permissions */

/**
 * Granular permissions an owner can grant an admin. The owner implicitly holds
 * all of them; `admin` holds whatever is stored on their membership row.
 */
export const PERMISSIONS = [
  "cards.manage",
  "cards.stamp",
  "customers.view",
  "customers.message",
  "analytics.view",
  "locations.manage",
  "marketplace.manage",
  "billing.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "cards.manage": "Create and edit loyalty cards",
  "cards.stamp": "Scan and stamp customer cards",
  "customers.view": "View customers",
  "customers.message": "Message customers",
  "analytics.view": "View analytics",
  "locations.manage": "Manage locations",
  "marketplace.manage": "Manage marketplace listing",
  "billing.manage": "Manage billing and subscription",
};

/** Sensible starting grants for a newly invited admin. */
export const DEFAULT_ADMIN_PERMISSIONS: readonly Permission[] = [
  "cards.stamp",
  "customers.view",
  "customers.message",
  "analytics.view",
];

/** Billing stays with the owner — an admin can never be granted it. */
export const OWNER_ONLY_PERMISSIONS: readonly Permission[] = ["billing.manage"];

export function permissionsForRole(
  role: "owner" | "admin",
  granted: readonly string[],
): ReadonlySet<Permission> {
  if (role === "owner") return new Set(PERMISSIONS);
  return new Set(
    granted.filter(
      (p): p is Permission =>
        (PERMISSIONS as readonly string[]).includes(p) &&
        !(OWNER_ONLY_PERMISSIONS as readonly string[]).includes(p),
    ),
  );
}
