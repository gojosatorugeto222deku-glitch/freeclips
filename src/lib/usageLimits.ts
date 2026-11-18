import type {
  DailyUsageState,
  PlanTier,
  ProDiscountState,
} from "@/types/subtitle";

export const FREE_DAILY_BASE = 5;
export const EXTRA_PACK_VIDEOS = 5;
export const MAX_EXTRA_PACKS = 2; // 5 base + 2*5 extra = 15 max daily free videos
export const MAX_DAILY_FREE_VIDEOS =
  FREE_DAILY_BASE + EXTRA_PACK_VIDEOS * MAX_EXTRA_PACKS;
export const FREE_MAX_DURATION_SEC = 90;

export const CREATOR_DAILY_LIMIT = 20;
export const CREATOR_MAX_DURATION_SEC = 15 * 60; // 15 minutos

export const AGENCY_DAILY_LIMIT = 50;
export const AGENCY_MAX_DURATION_SEC = 30 * 60; // 30 minutos

export const AD_UNLOCK_WAIT_SECONDS = 15;
export const SOCIAL_VERIFY_SECONDS = 5;

export interface PlanQuotaConfig {
  tier: PlanTier;
  label: string;
  dailyBaseLimit: number;
  maxDailyWithExtras: number;
  maxDurationSec: number;
  maxDurationLabel: string;
  allowsAdExtras: boolean;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanQuotaConfig> = {
  free: {
    tier: "free",
    label: "Gratis",
    dailyBaseLimit: FREE_DAILY_BASE,
    maxDailyWithExtras: MAX_DAILY_FREE_VIDEOS,
    maxDurationSec: FREE_MAX_DURATION_SEC,
    maxDurationLabel: "90 seg (1:30)",
    allowsAdExtras: true,
  },
  creator: {
    tier: "creator",
    label: "Plan Creador",
    dailyBaseLimit: CREATOR_DAILY_LIMIT,
    maxDailyWithExtras: CREATOR_DAILY_LIMIT,
    maxDurationSec: CREATOR_MAX_DURATION_SEC,
    maxDurationLabel: "15 min",
    allowsAdExtras: false,
  },
  agency: {
    tier: "agency",
    label: "Plan Agencia",
    dailyBaseLimit: AGENCY_DAILY_LIMIT,
    maxDailyWithExtras: AGENCY_DAILY_LIMIT,
    maxDurationSec: AGENCY_MAX_DURATION_SEC,
    maxDurationLabel: "30 min",
    allowsAdExtras: false,
  },
};

const USAGE_STORAGE_KEY = "sublimpio_daily_usage_v1";
const PRO_STORAGE_KEY = "sublimpio_pro_discount_v1";
const STORAGE_CHANGE_EVENT = "sublimpio-local-storage-change";

const SERVER_USAGE_SNAPSHOT: DailyUsageState = {
  date: "1970-01-01",
  usedCount: 0,
  extraPacksClaimed: 0,
};

const SERVER_DISCOUNT_SNAPSHOT: ProDiscountState = {
  planTier: "free",
  googleConnected: false,
  socialShared: false,
};

let cachedUsageKey: string | null = null;
let cachedUsageValue: DailyUsageState = SERVER_USAGE_SNAPSHOT;
let cachedDiscountRaw: string | null = null;
let cachedDiscountValue: ProDiscountState = SERVER_DISCOUNT_SNAPSHOT;

export function hasCreatorAccess(planTier: PlanTier): boolean {
  return planTier === "creator" || planTier === "agency";
}

export function hasAgencyAccess(planTier: PlanTier): boolean {
  return planTier === "agency";
}

export function getMaxDurationForPlan(planTier: PlanTier): number {
  return PLAN_CONFIGS[planTier].maxDurationSec;
}

/**
 * Returns YYYY-MM-DD in the user's local timezone so daily resets match midnight locally.
 */
export function getLocalDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createFreshUsageState(dateKey = getLocalDateKey()): DailyUsageState {
  return {
    date: dateKey,
    usedCount: 0,
    extraPacksClaimed: 0,
  };
}

export function normalizeUsageState(
  raw: Partial<DailyUsageState> | null | undefined,
  today = getLocalDateKey(),
  planTier: PlanTier = "free"
): DailyUsageState {
  if (!raw || raw.date !== today) {
    return createFreshUsageState(today);
  }
  const extraPacksClaimed =
    planTier === "free"
      ? Math.max(
          0,
          Math.min(MAX_EXTRA_PACKS, Math.floor(Number(raw.extraPacksClaimed) || 0))
        )
      : 0;
  const maxAllowed =
    planTier === "free"
      ? FREE_DAILY_BASE + extraPacksClaimed * EXTRA_PACK_VIDEOS
      : PLAN_CONFIGS[planTier].dailyBaseLimit;
  const usedCount = Math.max(
    0,
    Math.min(maxAllowed, Math.floor(Number(raw.usedCount) || 0))
  );
  return {
    date: today,
    usedCount,
    extraPacksClaimed,
  };
}

export function loadUsageState(planTier: PlanTier = "free"): DailyUsageState {
  if (typeof window === "undefined") return createFreshUsageState();
  try {
    const raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
    if (!raw) return createFreshUsageState();
    return normalizeUsageState(
      JSON.parse(raw) as Partial<DailyUsageState>,
      getLocalDateKey(),
      planTier
    );
  } catch {
    return createFreshUsageState();
  }
}

export function saveUsageState(state: DailyUsageState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  } catch {
    // Ignore quota/private-mode storage errors gracefully.
  }
}

export function subscribeLocalStorage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  };
}

export function getUsageSnapshot(): DailyUsageState {
  if (typeof window === "undefined") return SERVER_USAGE_SNAPSHOT;
  const today = getLocalDateKey();
  let raw: string | null = null;
  let planRaw: string | null = null;
  try {
    raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
    planRaw = window.localStorage.getItem(PRO_STORAGE_KEY);
  } catch {
    raw = null;
  }
  const cacheKey = `${today}::${raw ?? ""}::${planRaw ?? ""}`;
  if (cachedUsageKey === cacheKey) {
    return cachedUsageValue;
  }
  const tier = loadDiscountState().planTier;
  cachedUsageKey = cacheKey;
  cachedUsageValue = loadUsageState(tier);
  return cachedUsageValue;
}

export function getServerUsageSnapshot(): DailyUsageState {
  return SERVER_USAGE_SNAPSHOT;
}

export interface QuotaSummary {
  planTier: PlanTier;
  usedCount: number;
  totalAllowed: number;
  remaining: number;
  extraPacksClaimed: number;
  packsRemaining: number;
  canClaimExtraPack: boolean;
  allowsAdExtras: boolean;
  maxDailyLimit: number;
}

export function getQuotaSummary(
  state: DailyUsageState,
  planTier: PlanTier = "free"
): QuotaSummary {
  const cfg = PLAN_CONFIGS[planTier];
  if (planTier === "free") {
    const totalAllowed =
      FREE_DAILY_BASE + state.extraPacksClaimed * EXTRA_PACK_VIDEOS;
    const remaining = Math.max(0, totalAllowed - state.usedCount);
    const packsRemaining = Math.max(0, MAX_EXTRA_PACKS - state.extraPacksClaimed);
    return {
      planTier,
      usedCount: state.usedCount,
      totalAllowed,
      remaining,
      extraPacksClaimed: state.extraPacksClaimed,
      packsRemaining,
      canClaimExtraPack: packsRemaining > 0,
      allowsAdExtras: true,
      maxDailyLimit: MAX_DAILY_FREE_VIDEOS,
    };
  }

  const totalAllowed = cfg.dailyBaseLimit;
  const remaining = Math.max(0, totalAllowed - state.usedCount);
  return {
    planTier,
    usedCount: state.usedCount,
    totalAllowed,
    remaining,
    extraPacksClaimed: 0,
    packsRemaining: 0,
    canClaimExtraPack: false,
    allowsAdExtras: false,
    maxDailyLimit: cfg.dailyBaseLimit,
  };
}

export function consumeVideoCredit(
  state: DailyUsageState,
  planTier: PlanTier = "free"
): DailyUsageState {
  const summary = getQuotaSummary(state, planTier);
  if (summary.remaining <= 0) return state;
  return {
    ...state,
    usedCount: state.usedCount + 1,
  };
}

export function claimExtraVideoPack(state: DailyUsageState): DailyUsageState {
  if (state.extraPacksClaimed >= MAX_EXTRA_PACKS) {
    return state;
  }
  return {
    ...state,
    extraPacksClaimed: state.extraPacksClaimed + 1,
  };
}

export function isVideoDurationBlocked(
  durationSec: number,
  planTier: PlanTier
): boolean {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  return durationSec > getMaxDurationForPlan(planTier);
}

export function createDefaultDiscountState(): ProDiscountState {
  return {
    planTier: "free",
    googleConnected: false,
    socialShared: false,
  };
}

function normalizePlanTier(
  parsed: Partial<ProDiscountState>
): PlanTier {
  if (
    parsed.planTier === "free" ||
    parsed.planTier === "creator" ||
    parsed.planTier === "agency"
  ) {
    return parsed.planTier;
  }
  return parsed.isPro ? "creator" : "free";
}

export function loadDiscountState(): ProDiscountState {
  if (typeof window === "undefined") return createDefaultDiscountState();
  try {
    const raw = window.localStorage.getItem(PRO_STORAGE_KEY);
    if (!raw) return createDefaultDiscountState();
    const parsed = JSON.parse(raw) as Partial<ProDiscountState>;
    return {
      planTier: normalizePlanTier(parsed),
      googleConnected: Boolean(parsed.googleConnected),
      googleEmail: parsed.googleEmail,
      googleDisplayName: parsed.googleDisplayName,
      googlePhotoUrl: parsed.googlePhotoUrl,
      socialShared: Boolean(parsed.socialShared),
    };
  } catch {
    return createDefaultDiscountState();
  }
}

export function saveDiscountState(state: ProDiscountState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  } catch {
    // Ignore storage restriction errors.
  }
}

export function getDiscountSnapshot(): ProDiscountState {
  if (typeof window === "undefined") return SERVER_DISCOUNT_SNAPSHOT;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PRO_STORAGE_KEY);
  } catch {
    raw = null;
  }
  const cacheKey = raw ?? "";
  if (cachedDiscountRaw === cacheKey) {
    return cachedDiscountValue;
  }
  cachedDiscountRaw = cacheKey;
  cachedDiscountValue = loadDiscountState();
  return cachedDiscountValue;
}

export function getServerDiscountSnapshot(): ProDiscountState {
  return SERVER_DISCOUNT_SNAPSHOT;
}

export function isViralDiscountUnlocked(state: ProDiscountState): boolean {
  return state.googleConnected && state.socialShared;
}
