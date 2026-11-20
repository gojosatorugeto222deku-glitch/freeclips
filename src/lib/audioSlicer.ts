import type { RawWhisperChunk } from "@/lib/subtitles";
import { normalizeWhisperChunks } from "@/lib/subtitles";
import type { WordToken } from "@/types/subtitle";

export interface AudioSegment {
  index: number;
  startSec: number;
  endSec: number;
  pcm: Float32Array;
}

const DEFAULT_SAMPLE_RATE = 16000;

/**
 * Splits a 16 kHz mono Float32Array into silence-aligned chunks when audio
 * exceeds `singlePassMaxSec` so longer videos can be processed progressively
 * (and in parallel across workers on desktop) without slicing mid-word.
 */
export function splitAudioAtSilenceValleys(
  pcm: Float32Array,
  sampleRate = DEFAULT_SAMPLE_RATE,
  targetChunkSec = 22,
  singlePassMaxSec = 26
): AudioSegment[] {
  const totalSec = pcm.length / sampleRate;
  if (totalSec <= singlePassMaxSec || pcm.length === 0) {
    return [
      {
        index: 0,
        startSec: 0,
        endSec: roundTime(totalSec),
        pcm,
      },
    ];
  }

  const segments: AudioSegment[] = [];
  const searchRadiusSec = 3.5;
  const minTailSec = 6;
  const frameSamples = Math.max(160, Math.round(sampleRate * 0.04)); // 40ms window

  let cursorSample = 0;
  let segIndex = 0;

  while (cursorSample < pcm.length) {
    const remainingSec = (pcm.length - cursorSample) / sampleRate;
    if (remainingSec <= singlePassMaxSec) {
      segments.push({
        index: segIndex,
        startSec: roundTime(cursorSample / sampleRate),
        endSec: roundTime(pcm.length / sampleRate),
        pcm: pcm.subarray(cursorSample),
      });
      break;
    }

    const idealEnd = cursorSample + Math.round(targetChunkSec * sampleRate);
    const minEnd = Math.max(
      cursorSample + Math.round(10 * sampleRate),
      idealEnd - Math.round(searchRadiusSec * sampleRate)
    );
    const maxEnd = Math.min(
      pcm.length - Math.round(minTailSec * sampleRate),
      idealEnd + Math.round(searchRadiusSec * sampleRate)
    );

    let bestCut = Math.min(idealEnd, maxEnd);
    let lowestRms = Number.POSITIVE_INFINITY;

    for (let pos = minEnd; pos + frameSamples <= maxEnd; pos += frameSamples) {
      let sumSq = 0;
      for (let i = 0; i < frameSamples; i += 1) {
        const s = pcm[pos + i];
        sumSq += s * s;
      }
      const rms = sumSq / frameSamples;
      if (rms < lowestRms) {
        lowestRms = rms;
        bestCut = pos + Math.floor(frameSamples / 2);
      }
    }

    if (bestCut <= cursorSample + sampleRate) {
      bestCut = Math.min(pcm.length, idealEnd);
    }

    segments.push({
      index: segIndex,
      startSec: roundTime(cursorSample / sampleRate),
      endSec: roundTime(bestCut / sampleRate),
      pcm: pcm.subarray(cursorSample, bestCut),
    });

    cursorSample = bestCut;
    segIndex += 1;
  }

  return segments;
}

/**
 * Tightens leading and trailing silence inside a segment span using the real
 * 16 kHz PCM RMS envelope so word timings lock closely onto spoken speech.
 */
export function refineSpanByAudioEnergy(
  pcm: Float32Array | undefined,
  startSec: number,
  endSec: number,
  sampleRate = DEFAULT_SAMPLE_RATE
): [number, number] {
  if (!pcm || pcm.length === 0 || endSec - startSec < 0.4) {
    return [startSec, endSec];
  }

  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx = Math.min(pcm.length, Math.ceil(endSec * sampleRate));
  const frameLen = Math.max(160, Math.round(sampleRate * 0.025)); // 25ms frames
  const frameCount = Math.floor((endIdx - startIdx) / frameLen);
  if (frameCount < 4) {
    return [startSec, endSec];
  }

  const energies = new Float32Array(frameCount);
  let maxEnergy = 0;
  for (let f = 0; f < frameCount; f += 1) {
    const base = startIdx + f * frameLen;
    let sumSq = 0;
    for (let i = 0; i < frameLen; i += 1) {
      const v = pcm[base + i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / frameLen);
    energies[f] = rms;
    if (rms > maxEnergy) maxEnergy = rms;
  }

  if (maxEnergy < 0.008) {
    return [startSec, endSec];
  }

  const threshold = Math.max(0.006, maxEnergy * 0.14);
  let firstActive = 0;
  while (firstActive < frameCount - 1 && energies[firstActive] < threshold) {
    firstActive += 1;
  }

  let lastActive = frameCount - 1;
  while (lastActive > firstActive && energies[lastActive] < threshold) {
    lastActive -= 1;
  }

  // Keep a small 35ms natural pad around onset/offset so karaoke doesn't clip consonants.
  const refinedStart = Math.max(
    startSec,
    startSec + (firstActive * frameLen) / sampleRate - 0.035
  );
  const refinedEnd = Math.min(
    endSec,
    startSec + ((lastActive + 1) * frameLen) / sampleRate + 0.04
  );

  if (refinedEnd - refinedStart < 0.25) {
    return [startSec, endSec];
  }

  return [roundTime(refinedStart), roundTime(refinedEnd)];
}

/**
 * Converts either word-level chunks OR fast segment-level Whisper chunks into
 * accurate monotonic WordToken entries with energy-tightened boundaries and
 * character/punctuation-weighted word timing.
 */
export function expandChunksToWordTokens(
  rawChunks: RawWhisperChunk[],
  options: {
    pcm?: Float32Array;
    sampleRate?: number;
    totalDuration?: number;
    offsetSec?: number;
  } = {}
): WordToken[] {
  const {
    pcm,
    sampleRate = DEFAULT_SAMPLE_RATE,
    totalDuration,
    offsetSec = 0,
  } = options;

  if (!rawChunks || rawChunks.length === 0) return [];

  const isMultiWordSegmentOutput = rawChunks.some((c) => {
    const words = (c.text ?? "").trim().split(/\s+/).filter(Boolean);
    return words.length >= 2;
  });

  if (!isMultiWordSegmentOutput) {
    const shifted: RawWhisperChunk[] = rawChunks.map((c) => ({
      text: c.text,
      timestamp: [
        typeof c.timestamp?.[0] === "number" ? c.timestamp[0] + offsetSec : null,
        typeof c.timestamp?.[1] === "number" ? c.timestamp[1] + offsetSec : null,
      ],
    }));
    return normalizeWhisperChunks(shifted, totalDuration);
  }

  const expanded: RawWhisperChunk[] = [];
  let lastEnd = offsetSec;

  for (const seg of rawChunks) {
    const cleaned = (seg.text ?? "").trim();
    if (!cleaned) continue;

    const rawStart =
      typeof seg.timestamp?.[0] === "number" && Number.isFinite(seg.timestamp[0])
        ? Math.max(0, seg.timestamp[0])
        : Math.max(0, lastEnd - offsetSec);

    let rawEnd =
      typeof seg.timestamp?.[1] === "number" && Number.isFinite(seg.timestamp[1])
        ? Math.max(rawStart + 0.16, seg.timestamp[1])
        : rawStart + Math.max(0.4, cleaned.split(/\s+/).length * 0.34);

    if (pcm && pcm.length > 0) {
      const localMax = pcm.length / sampleRate;
      rawEnd = Math.min(localMax, Math.max(rawStart + 0.12, rawEnd));
    }

    const [activeStart, activeEnd] = refineSpanByAudioEnergy(
      pcm,
      rawStart,
      rawEnd,
      sampleRate
    );

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const weights = words.map((w) => {
      const letters = w.replace(/[¿¡.,!?;:…"'()«»]/g, "").length;
      const pauseBonus = /[.!?…]$/.test(w) ? 1.8 : /[,;:]$/.test(w) ? 1.0 : 0;
      return Math.max(1.8, letters) + pauseBonus;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const absStart = Math.max(lastEnd, activeStart + offsetSec);
    const absEnd = Math.max(absStart + 0.08 * words.length, activeEnd + offsetSec);
    const span = absEnd - absStart;

    let cursor = absStart;
    for (let i = 0; i < words.length; i += 1) {
      const share = (weights[i] / totalWeight) * span;
      const wStart = roundTime(cursor);
      const wEnd =
        i === words.length - 1
          ? roundTime(absEnd)
          : roundTime(Math.min(absEnd, cursor + share));
      cursor = wEnd;
      expanded.push({
        text: words[i],
        timestamp: [wStart, Math.max(wStart + 0.06, wEnd)],
      });
    }

    lastEnd = absEnd;
  }

  return normalizeWhisperChunks(expanded, totalDuration);
}

function roundTime(n: number): number {
  return Math.round(n * 1000) / 1000;
}
