import { describe, it, expect } from "vitest";
import { computeExperienceLevel } from "../resume/parser.js";
import { stripCodeFences } from "../utils/stripCodeFences.js";

describe("computeExperienceLevel", () => {
  it("sums durationMonths across all roles into years", () => {
    const result = computeExperienceLevel([
      { durationMonths: 24 },
      { durationMonths: 12 },
    ]);
    expect(result.totalYearsExperience).toBe(3);
  });

  it("returns junior for less than 2 years", () => {
    const result = computeExperienceLevel([{ durationMonths: 18 }]);
    expect(result.seniorityLevel).toBe("junior");
  });

  it("returns mid for 2 up to 5 years", () => {
    const result = computeExperienceLevel([{ durationMonths: 24 }]); // exactly 2 years
    expect(result.seniorityLevel).toBe("mid");
  });

  it("returns senior for 5 up to 9 years", () => {
    const result = computeExperienceLevel([{ durationMonths: 60 }]); // exactly 5 years
    expect(result.seniorityLevel).toBe("senior");
  });

  it("returns lead for 9+ years", () => {
    const result = computeExperienceLevel([{ durationMonths: 108 }]); // exactly 9 years
    expect(result.seniorityLevel).toBe("lead");
  });

  it("handles an empty workHistory without throwing", () => {
    const result = computeExperienceLevel([]);
    expect(result.totalYearsExperience).toBe(0);
    expect(result.seniorityLevel).toBe("junior");
  });
});

describe("stripCodeFences", () => {
  it("strips ```json fences", () => {
    const input = '```json\n{"name": "Moe"}\n```';
    expect(stripCodeFences(input)).toBe('{"name": "Moe"}');
  });

  it("strips plain ``` fences with no language tag", () => {
    const input = '```\n{"name": "Moe"}\n```';
    expect(stripCodeFences(input)).toBe('{"name": "Moe"}');
  });

  it("leaves plain JSON untouched when there are no fences", () => {
    const input = '{"name": "Moe"}';
    expect(stripCodeFences(input)).toBe('{"name": "Moe"}');
  });

  it("handles extra whitespace around fences", () => {
    const input = '   ```json\n{"name": "Moe"}\n```   ';
    expect(stripCodeFences(input)).toBe('{"name": "Moe"}');
  });
});
