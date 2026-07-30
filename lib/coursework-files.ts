export const MAX_COURSEWORK_FILE_SIZE = 20 * 1024 * 1024;
export const COURSEWORK_UPLOAD_INTENT_TTL_MINUTES = 10;

const MIME_TYPES_BY_EXTENSION: Record<string, ReadonlySet<string>> = {
  gif: new Set(["image/gif"]),
  heic: new Set(["image/heic"]),
  heif: new Set(["image/heif"]),
  jpeg: new Set(["image/jpeg"]),
  jpg: new Set(["image/jpeg"]),
  pdf: new Set(["application/pdf"]),
  png: new Set(["image/png"]),
  txt: new Set(["text/plain"]),
  webp: new Set(["image/webp"]),
};

export function safeCourseworkFileName(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[/\\\u0000-\u001f\u007f]/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return normalized || "attachment";
}

export function validateCourseworkFile(input: {
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
}): string | null {
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    return "Choose a non-empty file.";
  }
  if (input.fileSize > MAX_COURSEWORK_FILE_SIZE) {
    return "Files must be 20 MB or smaller.";
  }

  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const allowedMimeTypes = MIME_TYPES_BY_EXTENSION[extension];
  if (!allowedMimeTypes) {
    return "That file type is not allowed for a direct upload. Upload a PDF, image, or plain-text file, or attach the document through Google Drive.";
  }

  const mimeType = input.mimeType?.trim().toLowerCase() ?? "";
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    return "The uploaded file content type does not match an approved school document format.";
  }
  return null;
}

export function courseworkUploadMimeType(
  fileName: string,
  mimeType?: string | null
): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const allowedMimeTypes = MIME_TYPES_BY_EXTENSION[extension];
  if (!allowedMimeTypes) return null;

  const normalized = mimeType?.trim().toLowerCase() ?? "";
  if (normalized) return allowedMimeTypes.has(normalized) ? normalized : null;
  return allowedMimeTypes.values().next().value ?? null;
}

export function validateStoredCourseworkFile(input: {
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
}): string | null {
  if (input.fileSize === null || input.fileSize === undefined) {
    return "The private upload is missing verified size metadata. Upload the file again.";
  }
  if (!input.mimeType?.trim()) {
    return "The private upload is missing verified content-type metadata. Upload the file again.";
  }
  return validateCourseworkFile({
    fileName: input.fileName,
    fileSize: Number(input.fileSize),
    mimeType: input.mimeType,
  });
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function isHeifFamily(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") return false;
  const compatibleBrands = ascii(bytes, 8, Math.min(bytes.length - 8, 40));
  return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].some(
    (brand) => compatibleBrands.includes(brand)
  );
}

function isUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies the bytes stored in the private bucket instead of trusting the
 * browser-provided extension and Content-Type. This is format validation, not
 * malware scanning; private forced downloads remain a separate safety layer.
 */
export function validateCourseworkFileSignature(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): string | null {
  const metadataError = validateCourseworkFile({
    fileName: input.fileName,
    fileSize: input.bytes.byteLength,
    mimeType: input.mimeType,
  });
  if (metadataError) return metadataError;

  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const bytes = input.bytes;
  let matches = false;

  switch (extension) {
    case "pdf":
      matches = ascii(bytes, 0, 5) === "%PDF-";
      break;
    case "png":
      matches = startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case "jpg":
    case "jpeg":
      matches = startsWith(bytes, [0xff, 0xd8, 0xff]);
      break;
    case "gif":
      matches = ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a";
      break;
    case "webp":
      matches = ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
      break;
    case "heic":
    case "heif":
      matches = isHeifFamily(bytes);
      break;
    case "txt":
      matches = isUtf8Text(bytes);
      break;
  }

  return matches
    ? null
    : "The uploaded file contents do not match its approved document type.";
}
