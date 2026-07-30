import { describe, expect, it } from "vitest";
import {
  courseworkUploadMimeType,
  MAX_COURSEWORK_FILE_SIZE,
  safeCourseworkFileName,
  validateCourseworkFile,
  validateCourseworkFileSignature,
  validateStoredCourseworkFile,
} from "@/lib/coursework-files";

describe("coursework file safety", () => {
  it("accepts an approved extension only when the declared MIME type matches", () => {
    expect(validateCourseworkFile({
      fileName: "reflection.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
    })).toBeNull();
    expect(validateCourseworkFile({
      fileName: "renamed.pdf",
      fileSize: 1024,
      mimeType: "image/png",
    })).toMatch(/content type does not match/i);
    expect(validateCourseworkFile({
      fileName: "unknown.pdf",
      fileSize: 1024,
      mimeType: "application/octet-stream",
    })).toMatch(/content type does not match/i);
  });

  it("rejects executable, empty, and oversized uploads", () => {
    expect(validateCourseworkFile({
      fileName: "payload.exe",
      fileSize: 1024,
      mimeType: "application/octet-stream",
    })).toMatch(/file type is not allowed/i);
    expect(validateCourseworkFile({
      fileName: "empty.pdf",
      fileSize: 0,
      mimeType: "application/pdf",
    })).toMatch(/non-empty/i);
    expect(validateCourseworkFile({
      fileName: "large.pdf",
      fileSize: MAX_COURSEWORK_FILE_SIZE + 1,
      mimeType: "application/pdf",
    })).toMatch(/20 MB or smaller/i);
    expect(validateCourseworkFile({
      fileName: "macro-capable.doc",
      fileSize: 1024,
      mimeType: "application/msword",
    })).toMatch(/attach the document through Google Drive/i);
  });

  it("normalizes unsafe storage filenames", () => {
    expect(safeCourseworkFileName("../Report\u0000 Final.pdf")).toBe("Report- Final.pdf");
    expect(safeCourseworkFileName("   ")).toBe("attachment");
  });

  it("fails closed when trusted storage metadata omits size or MIME type", () => {
    expect(validateStoredCourseworkFile({
      fileName: "report.pdf",
      fileSize: null,
      mimeType: "application/pdf",
    })).toMatch(/missing verified size metadata/i);
    expect(validateStoredCourseworkFile({
      fileName: "report.pdf",
      fileSize: 1024,
      mimeType: null,
    })).toMatch(/missing verified content-type metadata/i);
    expect(validateStoredCourseworkFile({
      fileName: "report.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
    })).toBeNull();
  });

  it("derives an approved MIME type when the browser omits one", () => {
    expect(courseworkUploadMimeType("worksheet.pdf", "")).toBe("application/pdf");
    expect(courseworkUploadMimeType("worksheet.pdf", "image/png")).toBeNull();
    expect(courseworkUploadMimeType("payload.exe", "")).toBeNull();
  });

  it("checks PDF, image, and plain-text signatures", () => {
    const examples = [
      {
        fileName: "report.pdf",
        mimeType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7\n"),
      },
      {
        fileName: "photo.png",
        mimeType: "image/png",
        bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
      {
        fileName: "notes.txt",
        mimeType: "text/plain",
        bytes: new TextEncoder().encode("meeting notes"),
      },
    ];

    for (const example of examples) {
      expect(validateCourseworkFileSignature(example)).toBeNull();
    }
  });

  it("accepts HEIF-family brands and rejects renamed or binary text files", () => {
    const heic = new Uint8Array(16);
    heic.set(new TextEncoder().encode("ftyp"), 4);
    heic.set(new TextEncoder().encode("heic"), 8);
    expect(validateCourseworkFileSignature({
      fileName: "photo.heic",
      mimeType: "image/heic",
      bytes: heic,
    })).toBeNull();

    expect(validateCourseworkFileSignature({
      fileName: "renamed.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("not a PDF"),
    })).toMatch(/contents do not match/i);
    expect(validateCourseworkFileSignature({
      fileName: "binary.txt",
      mimeType: "text/plain",
      bytes: Uint8Array.from([0x61, 0x00, 0x62]),
    })).toMatch(/contents do not match/i);
  });
});
