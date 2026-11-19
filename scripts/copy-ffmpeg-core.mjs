import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const targets = [
  {
    srcDir: join(rootDir, "node_modules/@ffmpeg/ffmpeg/dist/esm"),
    destDir: join(rootDir, "public/ffmpeg/worker"),
    files: ["worker.js", "const.js", "errors.js"],
  },
  {
    srcDir: join(rootDir, "node_modules/@ffmpeg/core/dist/esm"),
    destDir: join(rootDir, "public/ffmpeg/st"),
    files: ["ffmpeg-core.js", "ffmpeg-core.wasm"],
  },
  {
    srcDir: join(rootDir, "node_modules/onnxruntime-web/dist"),
    destDir: join(rootDir, "public/ort"),
    files: [
      "ort-wasm-simd-threaded.mjs",
      "ort-wasm-simd-threaded.wasm",
      "ort-wasm-simd-threaded.asyncify.mjs",
      "ort-wasm-simd-threaded.asyncify.wasm",
    ],
  },
];

for (const group of targets) {
  if (!existsSync(group.srcDir)) {
    console.warn(`[copy-ffmpeg-core] Missing source directory: ${group.srcDir}`);
    continue;
  }
  mkdirSync(group.destDir, { recursive: true });
  for (const file of group.files) {
    const src = join(group.srcDir, file);
    const dest = join(group.destDir, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`[copy-ffmpeg-core] Copied ${file} -> ${dest}`);
    } else {
      console.warn(`[copy-ffmpeg-core] Missing file: ${src}`);
    }
  }
}
