import { describe, it, expect } from "vitest";
import { splitTitleBody, groupActivitiesByDay, filterActivities, buildActivityInsert, dayLabel, type CrmActivity } from "./crm-activity";

const act = (over: Partial<CrmActivity>): CrmActivity => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  type: "note",
  title: "Notiz",
  body: null,
  created_at: "2026-10-20T10:00:00Z",
  created_by: "u1",
  ...over,
});

describe("splitTitleBody", () => {
  it("nutzt die erste Zeile als Titel und den Rest als Body", () => {
    expect(splitTitleBody("Kurzer Titel\nZeile 2\nZeile 3", "Notiz")).toEqual({ title: "Kurzer Titel", body: "Zeile 2\nZeile 3" });
  });
  it("einzeilige Notiz hat keinen Body", () => {
    expect(splitTitleBody("Nur eine Zeile", "Notiz")).toEqual({ title: "Nur eine Zeile", body: null });
  });
  it("leerer Text fällt auf das Typ-Label zurück", () => {
    expect(splitTitleBody("   ", "Anruf")).toEqual({ title: "Anruf", body: null });
  });
  it("kürzt sehr lange erste Zeilen auf 80 Zeichen", () => {
    const long = "x".repeat(120);
    expect(splitTitleBody(long, "Notiz").title).toHaveLength(80);
  });
});

describe("buildActivityInsert", () => {
  it("baut eine Kontakt-Notiz ohne lead_id", () => {
    const row = buildActivityInsert({ text: "Hallo\nDetails", type: "note", userId: "u1", contactId: "c1" });
    expect(row).toMatchObject({ type: "note", title: "Hallo", body: "Details", created_by: "u1", contact_id: "c1" });
    expect(row).not.toHaveProperty("lead_id");
  });
  it("baut eine Lead-Notiz ohne contact_id", () => {
    const row = buildActivityInsert({ text: "Lead-Notiz", type: "note", userId: "u1", leadId: "l1" });
    expect(row).toMatchObject({ lead_id: "l1", title: "Lead-Notiz" });
    expect(row).not.toHaveProperty("contact_id");
  });
  it("unterstützt den Typ meeting", () => {
    expect(buildActivityInsert({ text: "Zoom", type: "meeting", userId: "u1", leadId: "l1" }).type).toBe("meeting");
  });
});

describe("groupActivitiesByDay", () => {
  it("gruppiert nach Tagen, neueste zuerst, angepinnte ganz oben", () => {
    const groups = groupActivitiesByDay([
      act({ id: "a", created_at: "2026-10-20T09:00:00Z" }),
      act({ id: "b", created_at: "2026-10-21T09:00:00Z" }),
      act({ id: "p", created_at: "2026-10-19T09:00:00Z", metadata: { pinned: true } }),
    ]);
    expect(groups[0].label).toBe("Angepinnt");
    expect(groups[0].items[0].id).toBe("p");
    expect(groups[1].items[0].id).toBe("b");
    expect(groups[2].items[0].id).toBe("a");
  });
});

describe("dayLabel", () => {
  it("kennt Heute und Gestern", () => {
    const now = new Date("2026-10-21T12:00:00");
    expect(dayLabel("2026-10-21T08:00:00", now)).toBe("Heute");
    expect(dayLabel("2026-10-20T08:00:00", now)).toBe("Gestern");
  });
});

describe("filterActivities", () => {
  it("filtert Statuswechsel kompakt", () => {
    const list = [act({ type: "note" }), act({ type: "status_change" }), act({ type: "call" })];
    expect(filterActivities(list, "Status")).toHaveLength(1);
    expect(filterActivities(list, "Alle")).toHaveLength(3);
    expect(filterActivities(list, "Anrufe")).toHaveLength(1);
  });
});
