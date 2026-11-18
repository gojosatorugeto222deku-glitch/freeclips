import { SubtitleCue, WordToken } from "@/types/subtitle";

export interface RawWhisperChunk {
  text: string;
  timestamp: [number | null, number | null];
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

const CLOSING_PUNCT_RE = /^[.,!?;:…]+$/;
const OPENING_PUNCT_RE = /^[¿¡"'(«]+$/;

/**
 * Normalizes raw Whisper word-level chunks into monotonic WordToken entries,
 * merging stray punctuation tokens cleanly for Spanish typography.
 */
export function normalizeWhisperChunks(
  rawChunks: RawWhisperChunk[],
  totalDuration?: number
): WordToken[] {
  const tokens: WordToken[] = [];
  let pendingPrefix = "";

  for (const chunk of rawChunks) {
    const rawText = (chunk.text ?? "").trim();
    if (!rawText) continue;

    const rawStart =
      typeof chunk.timestamp?.[0] === "number" && Number.isFinite(chunk.timestamp[0])
        ? Math.max(0, chunk.timestamp[0])
        : tokens.length > 0
          ? tokens[tokens.length - 1].end
          : 0;

    let rawEnd =
      typeof chunk.timestamp?.[1] === "number" && Number.isFinite(chunk.timestamp[1])
        ? Math.max(rawStart + 0.08, chunk.timestamp[1])
        : rawStart + 0.36;

    if (typeof totalDuration === "number" && totalDuration > 0) {
      rawEnd = Math.min(totalDuration, Math.max(rawStart + 0.06, rawEnd));
    }

    if (CLOSING_PUNCT_RE.test(rawText) && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      prev.text = `${prev.text}${rawText}`;
      prev.end = Math.max(prev.end, rawEnd);
      continue;
    }

    if (OPENING_PUNCT_RE.test(rawText)) {
      pendingPrefix = `${pendingPrefix}${rawText}`;
      continue;
    }

    const combinedText = pendingPrefix ? `${pendingPrefix}${rawText}` : rawText;
    pendingPrefix = "";

    const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    const start = Math.max(0, Math.min(rawStart, rawEnd - 0.06));
    let clampedStart = prev ? Math.max(start, prev.start) : start;
    if (prev && clampedStart < prev.end) {
      prev.end = roundTime(Math.max(prev.start + 0.06, clampedStart));
      clampedStart = Math.max(clampedStart, prev.end);
    }

    const end = Math.max(clampedStart + 0.08, rawEnd);
    tokens.push({
      id: nextId("w"),
      text: combinedText,
      start: roundTime(clampedStart),
      end: roundTime(end),
    });
  }

  if (pendingPrefix && tokens.length > 0) {
    tokens[tokens.length - 1].text += pendingPrefix;
  }

  return tokens;
}

/**
 * Groups word tokens into readable short-form video subtitle cues.
 */
export function groupWordsIntoCues(
  words: WordToken[],
  maxWordsPerCue = 4,
  maxCharsPerCue = 30,
  pauseThresholdSec = 0.45
): SubtitleCue[] {
  if (words.length === 0) return [];

  const safeMaxWords = Math.max(1, Math.min(8, Math.round(maxWordsPerCue)));
  const cues: SubtitleCue[] = [];
  let bucket: WordToken[] = [];
  let charCount = 0;

  const flushBucket = () => {
    if (bucket.length === 0) return;
    const start = bucket[0].start;
    const end = Math.max(start + 0.12, bucket[bucket.length - 1].end);
    cues.push({
      id: nextId("cue"),
      start: roundTime(start),
      end: roundTime(end),
      text: bucket.map((w) => w.text).join(" "),
      words: bucket.map((w) => ({ ...w })),
    });
    bucket = [];
    charCount = 0;
  };

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const prev = bucket[bucket.length - 1];

    if (prev) {
      const gap = word.start - prev.end;
      const endsWithStrongPunct = /[.!?…]$/.test(prev.text);
      const endsWithComma = /[,;:]$/.test(prev.text);
      const nextCharCount = charCount + 1 + word.text.length;

      if (
        bucket.length >= safeMaxWords ||
        gap >= pauseThresholdSec ||
        endsWithStrongPunct ||
        (endsWithComma && bucket.length >= 2) ||
        (nextCharCount > maxCharsPerCue && bucket.length >= 2)
      ) {
        flushBucket();
      }
    }

    bucket.push(word);
    charCount = charCount === 0 ? word.text.length : charCount + 1 + word.text.length;
  }

  flushBucket();
  return cues;
}

/**
 * Flattens cues back to word tokens (useful when changing words-per-line setting).
 */
export function extractWordsFromCues(cues: SubtitleCue[]): WordToken[] {
  const words: WordToken[] = [];
  for (const cue of cues) {
    if (cue.words.length > 0) {
      words.push(...cue.words);
    } else if (cue.text.trim()) {
      words.push(...distributeWordsAcrossSpan(cue.text, cue.start, cue.end));
    }
  }
  return words;
}

/**
 * Redistributes whitespace-separated words proportionally across a time span.
 */
export function distributeWordsAcrossSpan(
  text: string,
  start: number,
  end: number
): WordToken[] {
  const parts = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return [];

  const safeStart = Math.max(0, start);
  const safeEnd = Math.max(safeStart + 0.12 * parts.length, end);
  const totalSpan = safeEnd - safeStart;
  const totalWeight = parts.reduce((acc, p) => acc + Math.max(1, p.length), 0);

  let cursor = safeStart;
  return parts.map((wordText, index) => {
    const weight = Math.max(1, wordText.length);
    const share = (weight / totalWeight) * totalSpan;
    const wordStart = roundTime(cursor);
    const wordEnd =
      index === parts.length - 1
        ? roundTime(safeEnd)
        : roundTime(Math.min(safeEnd, cursor + share));
    cursor = wordEnd;
    return {
      id: nextId("w"),
      text: wordText,
      start: wordStart,
      end: Math.max(wordStart + 0.05, wordEnd),
    };
  });
}

/**
 * Updates cue text while preserving existing per-word timestamps if word count
 * matches, or re-interpolating across the cue span otherwise.
 */
export function updateCueText(cue: SubtitleCue, nextText: string): SubtitleCue {
  const parts = nextText
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      ...cue,
      text: "",
      words: [],
    };
  }

  let updatedWords: WordToken[];
  if (parts.length === cue.words.length) {
    updatedWords = cue.words.map((w, idx) => ({
      ...w,
      text: parts[idx],
    }));
  } else {
    updatedWords = distributeWordsAcrossSpan(parts.join(" "), cue.start, cue.end);
  }

  return {
    ...cue,
    text: parts.join(" "),
    words: updatedWords,
  };
}

/**
 * Updates cue start/end bounds and linearly scales inner word timings.
 */
export function updateCueTiming(
  cue: SubtitleCue,
  rawStart: number,
  rawEnd: number
): SubtitleCue {
  const nextStart = roundTime(Math.max(0, rawStart));
  const nextEnd = roundTime(Math.max(nextStart + 0.12, rawEnd));
  const oldSpan = Math.max(0.01, cue.end - cue.start);
  const newSpan = nextEnd - nextStart;

  const scaledWords = cue.words.map((w) => {
    const relStart = Math.max(0, Math.min(1, (w.start - cue.start) / oldSpan));
    const relEnd = Math.max(relStart, Math.min(1, (w.end - cue.start) / oldSpan));
    const s = roundTime(nextStart + relStart * newSpan);
    const e = roundTime(Math.max(s + 0.05, nextStart + relEnd * newSpan));
    return { ...w, start: s, end: e };
  });

  return {
    ...cue,
    start: nextStart,
    end: nextEnd,
    words: scaledWords,
  };
}

export function splitCueInMiddle(cue: SubtitleCue): [SubtitleCue, SubtitleCue] | null {
  const words =
    cue.words.length > 0
      ? cue.words
      : distributeWordsAcrossSpan(cue.text, cue.start, cue.end);
  if (words.length < 2) return null;

  const mid = Math.ceil(words.length / 2);
  const firstWords = words.slice(0, mid);
  const secondWords = words.slice(mid);

  const firstCue: SubtitleCue = {
    id: cue.id,
    start: firstWords[0].start,
    end: firstWords[firstWords.length - 1].end,
    text: firstWords.map((w) => w.text).join(" "),
    words: firstWords,
  };

  const secondCue: SubtitleCue = {
    id: nextId("cue"),
    start: secondWords[0].start,
    end: Math.max(secondWords[0].start + 0.12, secondWords[secondWords.length - 1].end),
    text: secondWords.map((w) => w.text).join(" "),
    words: secondWords,
  };

  return [firstCue, secondCue];
}

export function mergeTwoCues(first: SubtitleCue, second: SubtitleCue): SubtitleCue {
  const words = [
    ...(first.words.length > 0
      ? first.words
      : distributeWordsAcrossSpan(first.text, first.start, first.end)),
    ...(second.words.length > 0
      ? second.words
      : distributeWordsAcrossSpan(second.text, second.start, second.end)),
  ];

  return {
    id: first.id,
    start: Math.min(first.start, second.start),
    end: Math.max(first.end, second.end),
    text: words.map((w) => w.text).join(" "),
    words,
  };
}

export function shiftAllCues(
  cues: SubtitleCue[],
  deltaSeconds: number,
  maxDuration?: number
): SubtitleCue[] {
  return cues.map((cue) => {
    const nextStart = Math.max(0, cue.start + deltaSeconds);
    const rawEnd = Math.max(nextStart + 0.12, cue.end + deltaSeconds);
    const nextEnd =
      typeof maxDuration === "number" && maxDuration > 0
        ? Math.min(maxDuration, rawEnd)
        : rawEnd;
    return updateCueTiming(cue, nextStart, Math.max(nextStart + 0.12, nextEnd));
  });
}

export function createEmptyCueAt(timeSec: number, maxDuration?: number): SubtitleCue {
  const start = roundTime(Math.max(0, timeSec));
  const rawEnd = start + 1.5;
  const end =
    typeof maxDuration === "number" && maxDuration > 0
      ? roundTime(Math.min(maxDuration, Math.max(start + 0.25, rawEnd)))
      : roundTime(rawEnd);
  const text = "Nuevo subtítulo";
  return {
    id: nextId("cue"),
    start,
    end,
    text,
    words: distributeWordsAcrossSpan(text, start, end),
  };
}

/**
 * Generates standard SRT text for optional export or inspection.
 */
export function cuesToSrt(cues: SubtitleCue[], uppercase = false): string {
  const valid = cues.filter((c) => c.text.trim().length > 0);
  return valid
    .map((cue, index) => {
      const content = uppercase ? cue.text.toUpperCase() : cue.text;
      return `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${content}\n`;
    })
    .join("\n");
}

function formatSrtTime(sec: number): string {
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(Math.min(999, millis), 3)}`;
}

export function formatTimecode(sec: number): string {
  const safe = Math.max(0, sec);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const centis = Math.floor((safe - Math.floor(safe)) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

export function formatTimeShort(sec: number): string {
  const safe = Math.max(0, sec);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function parseTimecode(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = Number(trimmed);
    return Number.isFinite(val) && val >= 0 ? roundTime(val) : null;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 2) return null;
  const mins = Number(parts[0]);
  const secs = Number(parts[1]);
  if (!Number.isFinite(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0) {
    return null;
  }
  return roundTime(mins * 60 + secs);
}

export function findActiveCueAndWord(
  cues: SubtitleCue[],
  currentTime: number
): { cue: SubtitleCue | null; activeWordIndex: number } {
  for (const cue of cues) {
    if (currentTime >= cue.start && currentTime <= cue.end) {
      if (!cue.words.length) {
        return { cue, activeWordIndex: -1 };
      }
      let activeIdx = -1;
      for (let i = 0; i < cue.words.length; i += 1) {
        const w = cue.words[i];
        const nextWord = cue.words[i + 1];
        const effectiveEnd = nextWord ? nextWord.start : cue.end;
        if (currentTime >= w.start && currentTime <= effectiveEnd) {
          activeIdx = i;
          break;
        }
      }
      if (activeIdx === -1 && currentTime < cue.words[0].start) {
        activeIdx = 0;
      } else if (activeIdx === -1 && currentTime > cue.words[cue.words.length - 1].start) {
        activeIdx = cue.words.length - 1;
      }
      return { cue, activeWordIndex: activeIdx };
    }
  }
  return { cue: null, activeWordIndex: -1 };
}

function roundTime(n: number): number {
  return Math.round(n * 1000) / 1000;
}
