import { describe, expect, it } from "vitest";
import { formatSize } from "./format";

describe("formatSize", () => {
  it("formats bytes with binary units", () => {
    expect(formatSize(null)).toBe("-");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(28311552)).toBe("27.0 MB");
  });
});
