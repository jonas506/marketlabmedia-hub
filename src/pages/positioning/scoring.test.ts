import { describe, expect, it } from "vitest";
import { gradeFor, scoreLead } from "./scoring";

describe("positioning lead scoring", () => {
  it("top revenue + Kapitalanlagevertrieb = 100 / A", () => {
    expect(scoreLead("Über 100.000 €", "Kapitalanlagevertrieb")).toBe(100);
    expect(gradeFor(100)).toBe("A");
  });
  it("lowest revenue + Sonstiges = 23 / D", () => {
    expect(scoreLead("Unter 20.000 €", "Sonstiges")).toBe(23);
    expect(gradeFor(23)).toBe("D");
  });
  it("grade thresholds 80/60/40", () => {
    expect(gradeFor(80)).toBe("A");
    expect(gradeFor(79)).toBe("B");
    expect(gradeFor(60)).toBe("B");
    expect(gradeFor(59)).toBe("C");
    expect(gradeFor(40)).toBe("C");
    expect(gradeFor(39)).toBe("D");
  });
});
