import { describe, expect, it } from "vitest";
import { getInitials } from "./display";
describe("getInitials", () => {
  it("uses at most the first two name parts", () => {
    expect(getInitials("Jordan Lee Parker")).toBe("JL");
  });
  it("handles extra whitespace and a single name", () => {
    expect(getInitials("  Samira   ")).toBe("S");
  });
});
