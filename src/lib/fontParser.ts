import type { UploadedFontData } from "@/types/subtitle";

/**
 * Parses the SFNT `name` table from a TTF/OTF buffer in the browser so libass
 * receives the exact internal family name (`nameID=1`) and bold flag (`nameID=2`).
 */
export function parseFontMetadataFromBytes(
  fileName: string,
  bytes: Uint8Array
): Omit<UploadedFontData, "cssFamily"> {
  const fallbackName = fileName.replace(/\.(ttf|otf)$/i, "").trim() || "CustomFont";
  if (bytes.byteLength < 12) {
    return {
      fileName,
      assFontName: fallbackName,
      assBold: false,
      bytes,
    };
  }

  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const numTables = view.getUint16(4, false);
    let nameOffset = 0;

    for (let i = 0; i < numTables; i += 1) {
      const recordOffset = 12 + i * 16;
      if (recordOffset + 16 > bytes.byteLength) break;
      const tag = String.fromCharCode(
        bytes[recordOffset],
        bytes[recordOffset + 1],
        bytes[recordOffset + 2],
        bytes[recordOffset + 3]
      );
      if (tag === "name") {
        nameOffset = view.getUint32(recordOffset + 8, false);
        break;
      }
    }

    if (!nameOffset || nameOffset + 6 > bytes.byteLength) {
      return { fileName, assFontName: fallbackName, assBold: false, bytes };
    }

    const count = view.getUint16(nameOffset + 2, false);
    const stringStorageOffset = nameOffset + view.getUint16(nameOffset + 4, false);
    const names: Record<number, string> = {};

    for (let i = 0; i < count; i += 1) {
      const rec = nameOffset + 6 + i * 12;
      if (rec + 12 > bytes.byteLength) break;
      const platformId = view.getUint16(rec, false);
      const nameId = view.getUint16(rec + 6, false);
      const length = view.getUint16(rec + 8, false);
      const offset = view.getUint16(rec + 10, false);

      if ((platformId === 3 || platformId === 1) && [1, 2].includes(nameId)) {
        const start = stringStorageOffset + offset;
        const end = start + length;
        if (end > bytes.byteLength) continue;
        const slice = bytes.subarray(start, end);

        let decoded = "";
        if (platformId === 3) {
          decoded = new TextDecoder("utf-16be").decode(slice).trim();
        } else {
          decoded = new TextDecoder("latin1").decode(slice).trim();
        }

        if (decoded && (platformId === 3 || !names[nameId])) {
          names[nameId] = decoded;
        }
      }
    }

    const family = names[1] || fallbackName;
    const subfamily = (names[2] || "").toLowerCase();
    return {
      fileName,
      assFontName: family,
      assBold: subfamily.includes("bold"),
      bytes,
    };
  } catch {
    return {
      fileName,
      assFontName: fallbackName,
      assBold: false,
      bytes,
    };
  }
}
