import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const alt = "FreeClips — Subtítulos automáticos sin marca de agua";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(circle at 80% 18%, rgba(250, 204, 21, 0.22), transparent 46%), linear-gradient(145deg, #07080b 0%, #0f121a 65%, #07080b 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #fde047 0%, #f59e0b 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#090a0f",
              fontSize: "28px",
              fontWeight: 900,
            }}
          >
            ▶
          </div>
          <span style={{ fontSize: "38px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            FreeClips
          </span>
          <span
            style={{
              marginLeft: "12px",
              padding: "8px 18px",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.14)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#6ee7b7",
              fontSize: "22px",
              fontWeight: 600,
            }}
          >
            Sin marca de agua
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "960px" }}>
          <div
            style={{
              fontSize: "66px",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            Subtítulos automáticos con IA para tus videos cortos
          </div>
          <div style={{ fontSize: "28px", color: "#a1a1aa", lineHeight: 1.4 }}>
            Transcribe audio en español palabra por palabra, personaliza tu estilo y exporta MP4 listo para TikTok, Reels y Shorts.
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", fontSize: "22px", color: "#fde047" }}>
          <div
            style={{
              padding: "12px 22px",
              borderRadius: "12px",
              background: "rgba(250, 204, 21, 0.12)",
              border: "1px solid rgba(250, 204, 21, 0.35)",
            }}
          >
            5 videos gratis al día
          </div>
          <div
            style={{
              padding: "12px 22px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#e4e4e7",
            }}
          >
            Privacidad 100% en tu dispositivo
          </div>
          <div
            style={{
              padding: "12px 22px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#e4e4e7",
            }}
          >
            Exportación MP4 HD
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
