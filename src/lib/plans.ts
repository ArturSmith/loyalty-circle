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

/** Businesses created before tiered pricing, and anyone on the free trial. */
export const LEGACY_TIER: PlanTier = "growth";

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

export type Plan = {
  tier: PlanTier;
  name: string;
  /** Monthly price in USD. */
  price: number;
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
    price: 19,
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
    price: 49,
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
    price: 149,
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
  can: (feature: FeatureKey) => boolean;
  limitOf: (key: LimitKey) => Limit;
  /** Whether one more of `key` may be created, given current usage. */
  checkLimit: (key: LimitKey, used: number) => LimitCheck;
  /** The cheapest plan that includes `feature`, or null if none does. */
  upgradeFor: (feature: FeatureKey) => Plan | null;
};

const LIMIT_LABELS: Record<LimitKey, string> = {
  locations: "locations",
  loyaltyCards: "loyalty cards",
  administrators: "administrators",
};

export function entitlementsFor(tier: string | null | undefined): Entitlements {
  const plan = planFromTier(tier);

  const can = (feature: FeatureKey) => plan.features.includes(feature);
  const limitOf = (key: LimitKey) => plan.limits[key];

  const checkLimit = (key: LimitKey, used: number): LimitCheck => {
    const limit = plan.limits[key];
    if (limit === null) {
      return { allowed: true, limit: null, used, remaining: null, reason: null };
    }
    const allowed = used < limit;
    return {
      allowed,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      reason: allowed
        ? null
        : `Your ${plan.name} plan includes ${limit} ${LIMIT_LABELS[key]}. Upgrade to add more.`,
    };
  };

  const upgradeFor = (feature: FeatureKey): Plan | null =>
    PLAN_LIST.find((p) => p.features.includes(feature)) ?? null;

  return { plan, can, limitOf, checkLimit, upgradeFor };
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
