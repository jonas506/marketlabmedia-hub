import { describe, it, expect } from "vitest";
import { findDuplicateGroups, isWarmStale, isFollowupDue, parseCsv, waLink } from "./crm-contacts";

const c = (id: string, full_name: string, email: string | null = null, linkedin_url: string | null = null) => ({ id, full_name, company: null, email, linkedin_url });

describe("crm contacts", () => {
  it("finds duplicates by email, linkedin and name", () => {
    const g = findDuplicateGroups([
      c("1", "Alexander Clasen"), c("2", "alexander clasen "),
      c("3", "A", "x@y.de"), c("4", "B", "X@y.de"),
      c("5", "C", null, "https://linkedin.com/in/a/"), c("6", "D", null, "https://linkedin.com/in/a"),
    ]);
    expect(g.map(x => x.reason).sort()).toEqual(["Gleiche E-Mail", "Gleiche LinkedIn-URL", "Gleicher Name"]);
  });
  it("warm contacts without contact for 30+ days are stale, cold ones not", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(isWarmStale({ ...c("1", "a"), relationship: "lead", last_contact_at: "2026-09-21T12:00:00Z" }, 30, now)).toBe(true);
    expect(isWarmStale({ ...c("1", "a"), relationship: "lead", last_contact_at: "2026-10-01T12:00:00Z" }, 30, now)).toBe(false);
    expect(isWarmStale({ ...c("1", "a"), relationship: "kalt", last_contact_at: null }, 30, now)).toBe(false);
    expect(isWarmStale({ ...c("1", "a"), relationship: "lead", do_not_contact: true }, 30, now)).toBe(false);
  });
  it("follow-up due today or overdue", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(isFollowupDue({ next_followup_date: "2026-10-21" }, now)).toBe(true);
    expect(isFollowupDue({ next_followup_date: "2026-10-22" }, now)).toBe(false);
  });
  it("parses semicolon csv with quotes", () => {
    expect(parseCsv('Name;Firma\n"Max; M";ACME\n')).toEqual([["Name", "Firma"], ["Max; M", "ACME"]]);
  });
  it("builds wa.me links", () => {
    expect(waLink("0171 123")).toBe("https://wa.me/49171123");
  });
});
