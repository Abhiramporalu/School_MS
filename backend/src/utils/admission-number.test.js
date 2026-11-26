import { describe, expect, it } from "vitest";
import { generateAdmissionNumber } from "./admission-number.js";
#commit
describe("generateAdmissionNumber", () => {
  it("includes the current year and a unique generated suffix", () => {
    const date = new Date("2026-11-23T00:00:00.000Z");
    const first = generateAdmissionNumber(date);
    const second = generateAdmissionNumber(date);

    expect(first).toMatch(/^ADM-2026-[0-9A-F]{16}$/);
    expect(second).toMatch(/^ADM-2026-[0-9A-F]{16}$/);
    expect(first).not.toBe(second);
  });
});
