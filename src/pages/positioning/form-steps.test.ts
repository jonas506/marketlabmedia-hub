import { describe, expect, it } from "vitest";
import { isStepComplete, type PositioningFormData } from "./form-steps";

const empty: PositioningFormData = { industry: "", revenue: "", company: "", name: "", email: "", phone: "" };

describe("three-step positioning form", () => {
  it("step 1 requires industry, not revenue or contact data", () => {
    expect(isStepComplete(1, empty)).toBe(false);
    expect(isStepComplete(1, { ...empty, industry: "Finanzdienstleister" })).toBe(true);
  });
  it("step 2 requires monthly revenue", () => {
    expect(isStepComplete(2, { ...empty, industry: "Finanzdienstleister" })).toBe(false);
    expect(isStepComplete(2, { ...empty, revenue: "20.000 bis 50.000 €" })).toBe(true);
  });
  it("step 3 requires company, name, valid email and phone", () => {
    const contact = { ...empty, company: "Test", name: "Test Person", email: "test@example.com", phone: "0123456789" };
    expect(isStepComplete(3, contact)).toBe(true);
    for (const field of ["company", "name", "email", "phone"] as const) {
      expect(isStepComplete(3, { ...contact, [field]: "" })).toBe(false);
    }
    expect(isStepComplete(3, { ...contact, email: "invalid" })).toBe(false);
  });
});