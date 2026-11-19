import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const MODEL_ID = "onnx-community/whisper-tiny_timestamped";
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const DEST_ROOT = join(rootDir, "public", "models", ...MODEL_ID.split("/"));

const REQUIRED_FILES = [
  { rel: "config.json", minBytes: 200 },
  { rel: "generation_config.json", minBytes: 100 },
  { rel: "preprocessor_config.json", minBytes: 100 },
  { rel: "tokenizer_config.json", minBytes: 200 },
  { rel: "tokenizer.json", minBytes: 500_000 },
  { rel: "onnx/encoder_model_quantized.onnx", minBytes: 8_000_000 },
  { rel: "onnx/decoder_model_merged_quantized.onnx", minBytes: 25_000_000 },
];

async function downloadFile(url, destPath, minBytes) {
  mkdirSync(dirname(destPath), { recursive: true });
  const tmpPath = `${destPath}.part`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpPath));
      const size = statSync(tmpPath).size;
      if (size < minBytes) {
        throw new Error(`Incomplete download (${size} bytes < ${minBytes})`);
      }
      renameSync(tmpPath, destPath);
      return size;
    } catch (err) {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath);
      } catch {}
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  return 0;
}

async function main() {
  for (const item of REQUIRED_FILES) {
    const dest = join(DEST_ROOT, ...item.rel.split("/"));
    if (existsSync(dest) && statSync(dest).size >= item.minBytes) {
      console.log(`[sync-whisper-tiny] Cached ${item.rel}`);
      continue;
    }
    const url = `${BASE_URL}/${item.rel}`;
    console.log(`[sync-whisper-tiny] Downloading ${item.rel}...`);
    const bytes = await downloadFile(url, dest, item.minBytes);
    console.log(
      `[sync-whisper-tiny] Saved ${item.rel} (${(bytes / 1024 / 1024).toFixed(2)} MB)`
    );
  }
}

main().catch((err) => {
  // Non-fatal: runtime automatically falls back to HuggingFace if local files are missing.
  console.warn(`[sync-whisper-tiny] Skipped/partial sync: ${err?.message || err}`);
});
