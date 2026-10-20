import { describe, it, expect } from "vitest";
import {
  parseExperienceRange,
  meetsExperienceRequirement,
} from "../filters/experience.js";
import { meetsLocationRequirement } from "../filters/location.js";
import { normalizePersian } from "../utils/normalizePersian.js";

describe("parseExperienceRange", () => {
  it("treats a missing field as fieldAbsent", () => {
    expect(parseExperienceRange(undefined)).toEqual({ type: "fieldAbsent" });
  });

  it("recognizes مهم نیست as noRequirement", () => {
    expect(parseExperienceRange("مهم نیست")).toEqual({ type: "noRequirement" });
  });

  it("parses بیش از X سال as atLeast", () => {
    expect(parseExperienceRange("بیش از سه سال")).toEqual({ type: "atLeast", min: 3 });
  });

  it("parses a Persian word range", () => {
    expect(parseExperienceRange("دو تا چهار سال")).toEqual({ type: "range", min: 2, max: 4 });
  });

  it("returns unparseable for formats it does not understand", () => {
    expect(parseExperienceRange("۱ سال")).toEqual({ type: "unparseable", raw: "۱ سال" });
    expect(parseExperienceRange("سه سال")).toEqual({ type: "unparseable", raw: "سه سال" });
  });
});

describe("meetsExperienceRequirement", () => {
  it("fails open for every unknown case", () => {
    expect(meetsExperienceRequirement({ type: "noRequirement" }, 0, 1)).toBe(true);
    expect(meetsExperienceRequirement({ type: "fieldAbsent" }, 0, 1)).toBe(true);
    expect(meetsExperienceRequirement({ type: "unparseable", raw: "?" }, 0, 1)).toBe(true);
  });

  it("applies the tolerance buffer to a minimum requirement", () => {
    const req = { type: "atLeast" as const, min: 5 };
    expect(meetsExperienceRequirement(req, 4, 1)).toBe(true);
    expect(meetsExperienceRequirement(req, 3.5, 1)).toBe(false);
  });

  it("uses the lower bound of a range", () => {
    const req = { type: "range" as const, min: 2, max: 4 };
    expect(meetsExperienceRequirement(req, 1, 1)).toBe(true);
    expect(meetsExperienceRequirement(req, 0.5, 1)).toBe(false);
  });
});

describe("meetsLocationRequirement", () => {
  it("always passes remote jobs", () => {
    expect(
      meetsLocationRequirement("تهران، تهران", "تمام وقت, دورکاری", "رشت", "گیلان", true)
    ).toBe(true);
  });

  it("fails open when either side is unknown", () => {
    expect(meetsLocationRequirement("گیلان، رشت", "تمام وقت", undefined, "گیلان", false)).toBe(true);
    expect(meetsLocationRequirement(undefined, "تمام وقت", "رشت", "گیلان", false)).toBe(true);
  });

  it("matches at province level by default", () => {
    expect(meetsLocationRequirement("گیلان، رشت", "تمام وقت", "انزلی", "گیلان", false)).toBe(true);
    expect(meetsLocationRequirement("تهران، تهران", "تمام وقت", "رشت", "گیلان", false)).toBe(false);
  });

  it("tightens to exact city matching with hardMatch", () => {
    expect(meetsLocationRequirement("گیلان، رشت", "تمام وقت", "رشت", "گیلان", true)).toBe(true);
    expect(meetsLocationRequirement("گیلان، رشت", "تمام وقت", "انزلی", "گیلان", true)).toBe(false);
  });

  it("normalizes Arabic yeh/kaf variants before comparing", () => {
    expect(meetsLocationRequirement("گيلان، رشت", "تمام وقت", "رشت", "گیلان", false)).toBe(true);
  });
});

describe("normalizePersian", () => {
  it("normalizes Arabic look-alike characters and strips ZWNJ", () => {
    expect(normalizePersian("مي‌كند")).toBe("میکند");
  });
});
