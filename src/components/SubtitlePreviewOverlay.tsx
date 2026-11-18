"use client";

import type { CSSProperties } from "react";
import { computeBaseFontSize } from "@/lib/assGenerator";
import { resolveEffectiveStyle } from "@/lib/styles";
import type { SubtitleCue, SubtitleSettings } from "@/types/subtitle";

interface SubtitlePreviewOverlayProps {
  cue: SubtitleCue | null;
  activeWordIndex: number;
  settings: SubtitleSettings;
  videoWidth: number;
  videoHeight: number;
  renderedWidth: number;
  renderedHeight: number;
}

export function SubtitlePreviewOverlay({
  cue,
  activeWordIndex,
  settings,
  videoWidth,
  videoHeight,
  renderedWidth,
  renderedHeight,
}: SubtitlePreviewOverlayProps) {
  if (!cue || !cue.text.trim() || renderedWidth <= 0 || renderedHeight <= 0) {
    return null;
  }

  const effective = resolveEffectiveStyle(settings);
  const baseAssFontSize = computeBaseFontSize(
    videoWidth,
    videoHeight,
    settings.size
  );

  const scaleX = renderedWidth / Math.max(1, videoWidth);
  const scaleY = renderedHeight / Math.max(1, videoHeight);
  const scale = Math.min(scaleX, scaleY);
  const previewFontSize = Math.max(12, baseAssFontSize * scale);

  const isPortrait = videoHeight > videoWidth;
  const positionStyle: CSSProperties =
    settings.position === "top"
      ? { top: `${Math.round(renderedHeight * (isPortrait ? 0.12 : 0.09))}px` }
      : settings.position === "center"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: `${Math.round(renderedHeight * (isPortrait ? 0.17 : 0.11))}px` };

  const words =
    cue.words.length > 0
      ? cue.words
      : [{ id: "fallback", text: cue.text, start: cue.start, end: cue.end }];

  const transformText = (t: string) =>
    settings.uppercase ? t.toUpperCase() : t;

  const tiktokStrokePx = Math.max(2, previewFontSize * 0.18);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-[7%]"
      style={positionStyle}
    >
      <div
        className="flex max-w-full flex-wrap items-baseline justify-center gap-x-[0.26em] gap-y-[0.08em] text-center leading-[1.15]"
        style={{
          fontFamily: effective.fontFamilyCss,
          fontWeight: effective.cssFontWeight,
          fontSize: `${previewFontSize}px`,
        }}
      >
        {words.map((word, idx) => {
          const isActive =
            settings.highlightActiveWord && idx === activeWordIndex;
          const isSpoken =
            settings.highlightActiveWord &&
            activeWordIndex >= 0 &&
            idx < activeWordIndex;

          if (settings.styleId === "tiktok") {
            const color = !settings.highlightActiveWord
              ? effective.activeColorHex
              : isActive || isSpoken
                ? effective.activeColorHex
                : effective.baseColorHex;
            return (
              <span
                key={word.id}
                className="inline-block transition-transform duration-75"
                style={{
                  color,
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                  WebkitTextStroke: `${tiktokStrokePx}px ${effective.outlineColorHex}`,
                  paintOrder: "stroke fill",
                  textShadow: `0 ${Math.max(1.5, previewFontSize * 0.06)}px ${Math.max(3, previewFontSize * 0.14)}px rgba(0,0,0,0.92)`,
                }}
              >
                {transformText(word.text)}
              </span>
            );
          }

          if (settings.styleId === "minimal") {
            const isLit = !settings.highlightActiveWord || isActive || isSpoken;
            return (
              <span
                key={word.id}
                className="inline-block transition-opacity duration-100"
                style={{
                  color: isLit ? effective.activeColorHex : effective.baseColorHex,
                  opacity: isLit ? 1 : 0.72,
                  textShadow:
                    "0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.95)",
                }}
              >
                {transformText(word.text)}
              </span>
            );
          }

          const blurPrimary = Math.max(4, previewFontSize * 0.22);
          const blurOuter = Math.max(10, previewFontSize * 0.45);
          const strokeWidth = Math.max(0.8, previewFontSize * 0.045);

          return (
            <span
              key={word.id}
              className="inline-block transition-transform duration-75"
              style={{
                color: isActive
                  ? "#FFFFFF"
                  : isSpoken
                    ? "#ECFEFF"
                    : effective.baseColorHex,
                transform: isActive ? "scale(1.06)" : "scale(1)",
                WebkitTextStroke: `${strokeWidth}px ${
                  isActive ? effective.activeColorHex : effective.outlineColorHex
                }`,
                paintOrder: "stroke fill",
                textShadow: isActive
                  ? `0 0 ${blurPrimary}px ${effective.glowColorHex}, 0 0 ${blurOuter}px ${effective.activeColorHex}`
                  : `0 0 ${blurPrimary}px ${effective.outlineColorHex}, 0 0 ${blurOuter}px ${effective.outlineColorHex}`,
              }}
            >
              {transformText(word.text)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
