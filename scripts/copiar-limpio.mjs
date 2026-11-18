import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const targetArg = process.argv[2];
if (!targetArg) {
  console.error(
    'Uso: npm run copy:clean -- "C:\\ruta\\destino\\sublimpio"'
  );
  process.exit(1);
}

const destDir = resolve(targetArg);
const EXCLUDED = new Set(["node_modules", ".next", ".git", "coverage"]);

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else {
      total += statSync(full).size;
    }
  }
  return total;
}

if (destDir === rootDir || destDir.startsWith(`${rootDir}\\`) || destDir.startsWith(`${rootDir}/`)) {
  console.error("El destino no puede estar dentro de la carpeta actual del proyecto.");
  process.exit(1);
}

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
  if (EXCLUDED.has(entry.name)) continue;
  const srcPath = join(rootDir, entry.name);
  const dstPath = join(destDir, entry.name);
  cpSync(srcPath, dstPath, { recursive: true });
}

const copiedMb = (dirSizeBytes(destDir) / (1024 * 1024)).toFixed(2);
console.log(`Copia limpia completada en: ${destDir} (${copiedMb} MB)`);
console.log("En la nueva carpeta ejecuta: npm install && npm run dev");
