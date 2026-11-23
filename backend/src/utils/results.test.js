import { describe, expect, it } from "vitest";
import { calculateResult, divisionFor, gradeFor } from "./results.js";
describe("result calculation", () => {
  it("calculates totals, percentage, grade, division, and distinction from subject scores", () => {
    expect(calculateResult([
      { score: 90, maxMarks: 100, passMarks: 35 },
      { score: 80, maxMarks: 100, passMarks: 35 }
    ], 75)).toEqual({
      totalMarks: 170,
      maximumMarks: 200,
      percentage: 85,
      grade: "A",
      division: "First",
      passed: true,
      distinction: true
    });
  });
  it("fails a student who misses any subject's passing threshold", () => {
    const result = calculateResult([
      { score: 95, maxMarks: 100, passMarks: 35 },
      { score: 30, maxMarks: 100, passMarks: 35 }
    ]);
    expect(result.passed).toBe(false);
    expect(result.distinction).toBe(false);
  });
  it("maps percentage boundaries to configured grades and divisions", () => {
    expect([90, 80, 70, 60, 50, 49].map(gradeFor)).toEqual(["A+", "A", "B", "C", "D", "F"]);
    expect([60, 45, 33, 32].map(divisionFor)).toEqual(["First", "Second", "Third", "Needs improvement"]);
  });
});
