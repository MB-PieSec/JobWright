import { describe, it, expect } from "vitest";
import { mapApplyResultToStatus } from "../utils/mapApplyResultToStatus.js";
import { parseTotalResultCount as parseJobinjaCount } from "../platforms/jobinja/selectors.js";
import { parseTotalResultCount as parseJobvisionCount } from "../platforms/jobvision/selectors.js";

describe("mapApplyResultToStatus", () => {
  it("maps every apply outcome to its database status", () => {
    expect(mapApplyResultToStatus({ status: "success" })).toBe("applied");
    expect(mapApplyResultToStatus({ status: "alreadyApplied" })).toBe(
      "already_applied",
    );
    expect(mapApplyResultToStatus({ status: "expired" })).toBe("expired");
    expect(mapApplyResultToStatus({ status: "error", reason: "boom" })).toBe(
      "error",
    );
  });
});

describe("parseTotalResultCount", () => {
  it("parses Persian digits (Jobinja)", () => {
    expect(parseJobinjaCount("۱٬۲۳۴ موقعیت شغلی")).toBe(1234);
  });

  it("parses Arabic-Indic digits (Jobvision)", () => {
    expect(parseJobvisionCount("١٢٣٤ نتيجة")).toBe(1234);
  });

  it("returns null when no digits are present", () => {
    expect(parseJobinjaCount("بدون نتیجه")).toBeNull();
    expect(parseJobvisionCount("")).toBeNull();
  });
});
