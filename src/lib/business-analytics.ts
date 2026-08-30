export const ANALYTICS_RANGES = [7, 30, 90, 0] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type BusinessAnalyticsMetrics = {
  activeCustomers: number;
  returnVisits: number;
  returningCustomers: number;
  newCustomers: number;
  stamps: number;
  rewardsIssued: number;
  rewardsRedeemed: number;
};

export type BusinessAnalytics = {
  rangeDays: AnalyticsRange;
  generatedAt: string;
  current: BusinessAnalyticsMetrics;
  previous: BusinessAnalyticsMetrics;
  funnel: {
    joined: number;
    activated: number;
    returned: number;
    rewarded: number;
    redeemed: number;
  };
  timeline: Array<{
    start: string;
    stamps: number;
    activeCustomers: number;
  }>;
  cards: Array<{
    id: string;
    title: string;
    active: boolean;
    activeCustomers: number;
    stamps: number;
    returnVisits: number;
    returnRate: number;
    rewardsRedeemed: number;
    previousStamps: number;
  }>;
  insights: {
    nearRewardCustomers: number;
    staleRewards: number;
    inactiveCustomers: number;
  };
};

const EMPTY_METRICS: BusinessAnalyticsMetrics = {
  activeCustomers: 0,
  returnVisits: 0,
  returningCustomers: 0,
  newCustomers: 0,
  stamps: 0,
  rewardsIssued: 0,
  rewardsRedeemed: 0,
};

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metricsValue(value: unknown): BusinessAnalyticsMetrics {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    activeCustomers: numberValue(row.activeCustomers),
    returnVisits: numberValue(row.returnVisits),
    returningCustomers: numberValue(row.returningCustomers),
    newCustomers: numberValue(row.newCustomers),
    stamps: numberValue(row.stamps),
    rewardsIssued: numberValue(row.rewardsIssued),
    rewardsRedeemed: numberValue(row.rewardsRedeemed),
  };
}

export function emptyBusinessAnalytics(rangeDays: AnalyticsRange = 30): BusinessAnalytics {
  return {
    rangeDays,
    generatedAt: new Date(0).toISOString(),
    current: { ...EMPTY_METRICS },
    previous: { ...EMPTY_METRICS },
    funnel: { joined: 0, activated: 0, returned: 0, rewarded: 0, redeemed: 0 },
    timeline: [],
    cards: [],
    insights: { nearRewardCustomers: 0, staleRewards: 0, inactiveCustomers: 0 },
  };
}

/** Normalize the JSON RPC response at one boundary so UI components stay typed. */
export function parseBusinessAnalytics(
  value: unknown,
  fallbackRange: AnalyticsRange,
): BusinessAnalytics {
  const row = (value ?? {}) as Record<string, unknown>;
  const funnel = (row.funnel ?? {}) as Record<string, unknown>;
  const insights = (row.insights ?? {}) as Record<string, unknown>;
  const rawTimeline = Array.isArray(row.timeline) ? row.timeline : [];
  const rawCards = Array.isArray(row.cards) ? row.cards : [];
  const reportedRange = numberValue(row.rangeDays);
  const rangeDays = ANALYTICS_RANGES.includes(reportedRange as AnalyticsRange)
    ? (reportedRange as AnalyticsRange)
    : fallbackRange;

  return {
    rangeDays,
    generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : new Date().toISOString(),
    current: metricsValue(row.current),
    previous: metricsValue(row.previous),
    funnel: {
      joined: numberValue(funnel.joined),
      activated: numberValue(funnel.activated),
      returned: numberValue(funnel.returned),
      rewarded: numberValue(funnel.rewarded),
      redeemed: numberValue(funnel.redeemed),
    },
    timeline: rawTimeline
      .map((item) => {
        const point = (item ?? {}) as Record<string, unknown>;
        return {
          start: typeof point.start === "string" ? point.start : "",
          stamps: numberValue(point.stamps),
          activeCustomers: numberValue(point.activeCustomers),
        };
      })
      .filter((point) => point.start.length > 0),
    cards: rawCards
      .map((item) => {
        const card = (item ?? {}) as Record<string, unknown>;
        return {
          id: typeof card.id === "string" ? card.id : "",
          title: typeof card.title === "string" ? card.title : "Loyalty card",
          active: card.active === true,
          activeCustomers: numberValue(card.activeCustomers),
          stamps: numberValue(card.stamps),
          returnVisits: numberValue(card.returnVisits),
          returnRate: numberValue(card.returnRate),
          rewardsRedeemed: numberValue(card.rewardsRedeemed),
          previousStamps: numberValue(card.previousStamps),
        };
      })
      .filter((card) => card.id.length > 0),
    insights: {
      nearRewardCustomers: numberValue(insights.nearRewardCustomers),
      staleRewards: numberValue(insights.staleRewards),
      inactiveCustomers: numberValue(insights.inactiveCustomers),
    },
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}
