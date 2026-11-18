import { describe, expect, it } from "vitest";
import {
  formatAssTime,
  generateAssSubtitles,
  hexToAssColor,
  hexToAssInlineColor,
} from "@/lib/assGenerator";
import {
  computeTargetExportDimensions,
  formatExportError,
} from "@/lib/exportUtils";
import { parseFontMetadataFromBytes } from "@/lib/fontParser";
import { resolveStripeCheckoutLink } from "@/lib/stripeLinks";
import {
  isCreatorSessionPaid,
  isValidEmail,
  isValidStripeSessionId,
} from "@/lib/stripeServer";
import { DEFAULT_SUBTITLE_SETTINGS } from "@/lib/styles";
import {
  claimExtraVideoPack,
  consumeVideoCredit,
  createFreshUsageState,
  getQuotaSummary,
  hasAgencyAccess,
  hasCreatorAccess,
  isVideoDurationBlocked,
  isViralDiscountUnlocked,
  normalizeUsageState,
} from "@/lib/usageLimits";
import {
  cuesToSrt,
  findActiveCueAndWord,
  groupWordsIntoCues,
  mergeTwoCues,
  normalizeWhisperChunks,
  parseTimecode,
  splitCueInMiddle,
  updateCueText,
  updateCueTiming,
} from "@/lib/subtitles";

describe("normalizeWhisperChunks", () => {
  it("normalizes spacing and attaches Spanish punctuation cleanly", () => {
    const tokens = normalizeWhisperChunks([
      { text: " ¿", timestamp: [0.1, 0.15] },
      { text: " Cómo", timestamp: [0.15, 0.42] },
      { text: " estás", timestamp: [0.45, 0.88] },
      { text: "?", timestamp: [0.88, 0.92] },
      { text: " Genial", timestamp: [1.4, null] },
    ]);

    expect(tokens.map((t) => t.text)).toEqual(["¿Cómo", "estás?", "Genial"]);
    expect(tokens[0].start).toBeCloseTo(0.15, 2);
    expect(tokens[1].end).toBeGreaterThanOrEqual(0.88);
    expect(tokens[2].end).toBeGreaterThan(tokens[2].start);
  });

  it("enforces monotonic start times across chunk boundaries", () => {
    const tokens = normalizeWhisperChunks([
      { text: "uno", timestamp: [1.0, 1.5] },
      { text: "dos", timestamp: [0.9, 1.8] },
    ]);
    expect(tokens[1].start).toBeGreaterThanOrEqual(tokens[0].start);
    expect(tokens[0].end).toBeLessThanOrEqual(tokens[1].start);
  });
});

describe("groupWordsIntoCues and editing helpers", () => {
  it("groups words by maxWordsPerCue and pauses", () => {
    const words = normalizeWhisperChunks([
      { text: "Hola", timestamp: [0.0, 0.3] },
      { text: "amigos", timestamp: [0.32, 0.7] },
      { text: "hoy", timestamp: [1.4, 1.7] },
      { text: "probamos", timestamp: [1.75, 2.2] },
      { text: "SubLimpio", timestamp: [2.25, 2.8] },
      { text: "gratis", timestamp: [2.85, 3.2] },
    ]);

    const cues = groupWordsIntoCues(words, 3);
    expect(cues).toHaveLength(3);
    expect(cues[0].text).toBe("Hola amigos");
    expect(cues[1].text).toBe("hoy probamos SubLimpio");
    expect(cues[2].text).toBe("gratis");
  });

  it("preserves word timestamps when updating text with same word count", () => {
    const words = normalizeWhisperChunks([
      { text: "cancion", timestamp: [0.5, 0.9] },
      { text: "nueva", timestamp: [0.95, 1.4] },
    ]);
    const [cue] = groupWordsIntoCues(words, 4);
    const updated = updateCueText(cue, "canción nueva");
    expect(updated.text).toBe("canción nueva");
    expect(updated.words[0].start).toBe(0.5);
    expect(updated.words[0].end).toBe(0.9);
    expect(updated.words[1].text).toBe("nueva");
  });

  it("redistributes word timings when word count changes", () => {
    const words = normalizeWhisperChunks([
      { text: "hola", timestamp: [1.0, 2.0] },
    ]);
    const [cue] = groupWordsIntoCues(words, 4);
    const updated = updateCueText(cue, "hola a todos");
    expect(updated.words).toHaveLength(3);
    expect(updated.words[0].start).toBe(1.0);
    expect(updated.words[2].end).toBe(2.0);
  });

  it("supports splitting, merging, and rescaling cue timing", () => {
    const words = normalizeWhisperChunks([
      { text: "uno", timestamp: [0, 0.5] },
      { text: "dos", timestamp: [0.5, 1.0] },
      { text: "tres", timestamp: [1.0, 1.5] },
      { text: "cuatro", timestamp: [1.5, 2.0] },
    ]);
    const [cue] = groupWordsIntoCues(words, 4);
    const split = splitCueInMiddle(cue);
    expect(split).not.toBeNull();
    const [a, b] = split!;
    expect(a.text).toBe("uno dos");
    expect(b.text).toBe("tres cuatro");

    const merged = mergeTwoCues(a, b);
    expect(merged.text).toBe("uno dos tres cuatro");

    const shifted = updateCueTiming(merged, 2, 6);
    expect(shifted.start).toBe(2);
    expect(shifted.end).toBe(6);
    expect(shifted.words[0].start).toBe(2);
    expect(shifted.words[3].end).toBe(6);
  });

  it("finds active cue and word without flicker", () => {
    const words = normalizeWhisperChunks([
      { text: "uno", timestamp: [0.2, 0.5] },
      { text: "dos", timestamp: [0.6, 1.0] },
    ]);
    const cues = groupWordsIntoCues(words, 4);
    expect(findActiveCueAndWord(cues, 0.55).activeWordIndex).toBe(0);
    expect(findActiveCueAndWord(cues, 0.65).activeWordIndex).toBe(1);
    expect(findActiveCueAndWord(cues, 1.5).cue).toBeNull();
  });

  it("parses timecodes and exports valid SRT", () => {
    expect(parseTimecode("01:12.50")).toBeCloseTo(72.5, 2);
    expect(parseTimecode("8.25")).toBeCloseTo(8.25, 2);
    expect(parseTimecode("bad")).toBeNull();

    const words = normalizeWhisperChunks([
      { text: "hola", timestamp: [0, 1] },
    ]);
    const cues = groupWordsIntoCues(words, 4);
    const srt = cuesToSrt(cues, true);
    expect(srt).toContain("00:00:00,000 --> 00:00:01,000");
    expect(srt).toContain("HOLA");
  });
});

describe("assGenerator", () => {
  it("converts hex colors to ASS BGR formats accurately", () => {
    expect(hexToAssColor("#FFE600")).toBe("&H0000E6FF");
    expect(hexToAssInlineColor("#FFE600")).toBe("&H00E6FF&");
    expect(hexToAssInlineColor("#06B6D4")).toBe("&HD4B606&");
  });

  it("formats ASS timestamps accurately", () => {
    expect(formatAssTime(0)).toBe("0:00:00.00");
    expect(formatAssTime(65.432)).toBe("0:01:05.43");
  });

  it("generates tiktok, minimal, and two-layer neon ASS dialogues", () => {
    const words = normalizeWhisperChunks([
      { text: "Hola", timestamp: [0.1, 0.5] },
      { text: "mundo", timestamp: [0.55, 1.0] },
    ]);
    const cues = groupWordsIntoCues(words, 4);

    const tiktokAss = generateAssSubtitles(cues, {
      width: 1080,
      height: 1920,
      settings: { ...DEFAULT_SUBTITLE_SETTINGS, styleId: "tiktok" },
    });
    expect(tiktokAss).toContain("PlayResX: 1080");
    expect(tiktokAss).toContain("PlayResY: 1920");
    expect(tiktokAss).toContain("Montserrat ExtraBold");
    expect(tiktokAss).toContain("&H00E6FF&");
    expect(tiktokAss).toContain("HOLA");
    expect(tiktokAss).toContain(",326,1"); // 17% bottom safe-zone for 1920px portrait height

    const minimalAss = generateAssSubtitles(cues, {
      width: 1920,
      height: 1080,
      settings: {
        ...DEFAULT_SUBTITLE_SETTINGS,
        styleId: "minimal",
        uppercase: false,
      },
    });
    expect(minimalAss).toContain("Plus Jakarta Sans SemiBold");
    expect(minimalAss).toContain("Hola");

    const neonAss = generateAssSubtitles(cues, {
      width: 1080,
      height: 1920,
      settings: {
        ...DEFAULT_SUBTITLE_SETTINGS,
        styleId: "neon",
        uppercase: false,
      },
    });
    expect(neonAss).toContain("Style: NeonGlow");
    expect(neonAss).toContain("Style: NeonCore");
    expect(neonAss).toContain("Dialogue: 0,");
    expect(neonAss).toContain("Dialogue: 1,");
  });
});

describe("exportUtils", () => {
  it("computes even dimensions and respects quality preset caps", () => {
    expect(computeTargetExportDimensions(1080, 1920, "fast")).toEqual({
      width: 720,
      height: 1280,
      scaled: true,
      verticalCropped: false,
    });
    expect(computeTargetExportDimensions(720, 1280, "fast")).toEqual({
      width: 720,
      height: 1280,
      scaled: false,
      verticalCropped: false,
    });
    expect(computeTargetExportDimensions(2160, 3840, "balanced")).toEqual({
      width: 1080,
      height: 1920,
      scaled: true,
      verticalCropped: false,
    });
    expect(computeTargetExportDimensions(1079, 1919, "high")).toEqual({
      width: 1078,
      height: 1918,
      scaled: false,
      verticalCropped: false,
    });
    expect(computeTargetExportDimensions(1920, 1080, "balanced", true)).toEqual({
      width: 1080,
      height: 1920,
      scaled: true,
      verticalCropped: true,
    });
  });

  it("translates low-level fetch and OOM errors into clear Spanish messages", () => {
    expect(formatExportError(new TypeError("Failed to fetch"))).toContain(
      "FFmpeg.wasm"
    );
    expect(formatExportError(new Error("RuntimeError: out of bounds memory"))).toContain(
      "Rápida (720p)"
    );
  });
});

describe("usageLimits and viral discount", () => {
  it("tracks 5 free videos daily and unlocks up to 2 extra packs (+5 each = 15 max)", () => {
    let state = createFreshUsageState("2026-11-17");
    expect(getQuotaSummary(state).remaining).toBe(5);
    expect(getQuotaSummary(state).totalAllowed).toBe(5);

    for (let i = 0; i < 5; i += 1) {
      state = consumeVideoCredit(state);
    }
    expect(getQuotaSummary(state).remaining).toBe(0);
    expect(getQuotaSummary(state).canClaimExtraPack).toBe(true);

    // Pack 1 -> +5 (10 total)
    state = claimExtraVideoPack(state);
    expect(getQuotaSummary(state).remaining).toBe(5);
    expect(getQuotaSummary(state).totalAllowed).toBe(10);

    // Pack 2 -> +5 (15 max total)
    state = claimExtraVideoPack(state);
    expect(getQuotaSummary(state).totalAllowed).toBe(15);
    expect(getQuotaSummary(state).canClaimExtraPack).toBe(false);

    // Third attempt does not exceed 15
    state = claimExtraVideoPack(state);
    expect(getQuotaSummary(state).totalAllowed).toBe(15);
  });

  it("resets daily usage when calendar date changes", () => {
    const yesterday = {
      date: "2026-11-16",
      usedCount: 12,
      extraPacksClaimed: 2,
    };
    const today = normalizeUsageState(yesterday, "2026-11-17");
    expect(today.usedCount).toBe(0);
    expect(today.extraPacksClaimed).toBe(0);
    expect(getQuotaSummary(today).remaining).toBe(5);
  });

  it("enforces tier daily limits (5/15 free, 20 creator, 50 agency) and max durations", () => {
    const empty = createFreshUsageState("2026-11-17");
    expect(getQuotaSummary(empty, "creator").totalAllowed).toBe(20);
    expect(getQuotaSummary(empty, "creator").allowsAdExtras).toBe(false);
    expect(getQuotaSummary(empty, "agency").totalAllowed).toBe(50);

    let creatorState = empty;
    for (let i = 0; i < 25; i += 1) {
      creatorState = consumeVideoCredit(creatorState, "creator");
    }
    expect(creatorState.usedCount).toBe(20);
    expect(getQuotaSummary(creatorState, "creator").remaining).toBe(0);

    expect(isVideoDurationBlocked(90, "free")).toBe(false);
    expect(isVideoDurationBlocked(90.5, "free")).toBe(true);
    expect(isVideoDurationBlocked(900, "creator")).toBe(false);
    expect(isVideoDurationBlocked(901, "creator")).toBe(true);
    expect(isVideoDurationBlocked(1800, "agency")).toBe(false);
    expect(isVideoDurationBlocked(1801, "agency")).toBe(true);

    expect(hasCreatorAccess("free")).toBe(false);
    expect(hasCreatorAccess("creator")).toBe(true);
    expect(hasAgencyAccess("creator")).toBe(false);
    expect(hasAgencyAccess("agency")).toBe(true);

    expect(
      isViralDiscountUnlocked({
        planTier: "free",
        googleConnected: false,
        socialShared: false,
      })
    ).toBe(false);
    expect(
      isViralDiscountUnlocked({
        planTier: "free",
        googleConnected: true,
        socialShared: false,
      })
    ).toBe(false);
    expect(
      isViralDiscountUnlocked({
        planTier: "free",
        googleConnected: true,
        socialShared: true,
      })
    ).toBe(true);
  });
});

describe("stripeLinks and fontParser", () => {
  it("resolves configured checkout URLs for 5 USD, 3 USD, and 10 USD Agency tiers", () => {
    const prev5 = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_5USD;
    const prev3 = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_3USD;
    const prev10 = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD;

    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_5USD =
      "https://buy.stripe.com/test_5usd";
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_3USD =
      "https://buy.stripe.com/test_3usd";
    process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD =
      "https://mpago.la/agency_10usd";

    const res5 = resolveStripeCheckoutLink("5usd");
    const res3 = resolveStripeCheckoutLink("3usd", "user@example.com");
    const res10 = resolveStripeCheckoutLink("10usd_agency");

    expect(res5.configured).toBe(true);
    expect(res5.url).toBe("https://buy.stripe.com/test_5usd");
    expect(res3.configured).toBe(true);
    expect(res3.url).toBe(
      "https://buy.stripe.com/test_3usd?prefilled_email=user%40example.com"
    );
    expect(res10.configured).toBe(true);
    expect(res10.url).toBe("https://mpago.la/agency_10usd");

    delete process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD;
    const unconfigured = resolveStripeCheckoutLink("10usd_agency");
    expect(unconfigured.configured).toBe(false);
    expect(unconfigured.envVarName).toBe(
      "NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD"
    );

    if (prev5 !== undefined) process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_5USD = prev5;
    else delete process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_5USD;
    if (prev3 !== undefined) process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_3USD = prev3;
    else delete process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_3USD;
    if (prev10 !== undefined)
      process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD = prev10;
    else delete process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_AGENCY_10USD;
  });

  it("extracts family name from bundled TTF font bytes", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const buf = fs.readFileSync(
      path.resolve("public/fonts/SpaceGrotesk-Bold.ttf")
    );
    const parsed = parseFontMetadataFromBytes("SpaceGrotesk-Bold.ttf", new Uint8Array(buf));
    expect(parsed.assFontName).toBe("Space Grotesk");
    expect(parsed.assBold).toBe(true);
  });
});

describe("assGenerator Pro overrides", () => {
  it("applies custom Pro font and colors when set", () => {
    const cues = groupWordsIntoCues(
      normalizeWhisperChunks([{ text: "Prueba", timestamp: [0.1, 0.8] }]),
      4
    );
    const ass = generateAssSubtitles(cues, {
      width: 1080,
      height: 1920,
      settings: {
        ...DEFAULT_SUBTITLE_SETTINGS,
        styleId: "tiktok",
        customFontId: "space",
        customActiveColorHex: "#00FFAA",
      },
    });
    expect(ass).toContain("Space Grotesk");
    expect(ass).toContain("&HAAFF00&");
  });
});

describe("stripeServer helpers", () => {
  it("validates checkout session IDs and emails safely", () => {
    expect(isValidStripeSessionId("cs_live_a1B2c3D4e5F6g7H8")).toBe(true);
    expect(isValidStripeSessionId("cs_test_1234567890abcdef")).toBe(true);
    expect(isValidStripeSessionId("invalid_session")).toBe(false);
    expect(isValidStripeSessionId("cs_live_short")).toBe(false);

    expect(isValidEmail("creador@freeclips.dev")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("verifies completed paid FreeClips sessions and rejects unpaid or foreign sessions", () => {
    expect(
      isCreatorSessionPaid({
        id: "cs_live_1234567890ab",
        status: "complete",
        payment_status: "paid",
        metadata: { app: "freeclips", plan_tier: "creator" },
      })
    ).toBe(true);

    expect(
      isCreatorSessionPaid({
        id: "cs_live_1234567890ab",
        status: "open",
        payment_status: "unpaid",
        metadata: { app: "freeclips" },
      })
    ).toBe(false);

    expect(
      isCreatorSessionPaid({
        id: "cs_live_1234567890ab",
        status: "complete",
        payment_status: "paid",
        metadata: { app: "other_unrelated_app" },
      })
    ).toBe(false);
  });
});
