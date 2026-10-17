import { describe, expect, it, vi } from "vitest";
import { buildLeadMessage, sendSlack, TEST_MESSAGE } from "./message";

const lead = {
  id: "c80c5f7d-e56d-4c88-88bb-6dd5a08a43ce", contact_name: "Jonas Fesser",
  company: "Marketlab Media", industry: "Finanzdienstleister", utm_source: "facebook",
  utm_campaign: "Analyse", utm_content: "Video", created_at: "2026-10-17T09:03:00Z",
  email: "private@example.test", phone: "+49123456789",
};
describe("minimal funnel Slack data", () => {
  it("never includes surname, email or telephone", () => {
    const message = buildLeadMessage(lead);
    expect(message).toContain("Jonas");
    for (const forbidden of ["Fesser", lead.email, lead.phone]) expect(message).not.toContain(forbidden);
  });
  it("converts the lead timestamp to Berlin time including DST", () => {
    expect(buildLeadMessage(lead)).toContain("17.10.26, 11:03");
    expect(buildLeadMessage({ ...lead, created_at: "2026-12-17T09:03:00Z" })).toContain("17.12.26, 10:03");
  });
  it("uses direct/organic when all campaign fields are empty", () => {
    expect(buildLeadMessage({ ...lead, utm_source: null, utm_campaign: "", utm_content: null })).toContain("Quelle: direkt/organisch");
  });
  it("includes only the three requested campaign fields", () => {
    expect(buildLeadMessage(lead)).toContain("Quelle: facebook / Analyse / Video");
  });
  it("prevents Slack mention injection", () => {
    expect(buildLeadMessage({ ...lead, company: "<!channel>\nInjected" })).not.toContain("<!channel>");
  });
  it("contains an authenticated admin link targeted to the lead", () => {
    expect(buildLeadMessage(lead)).toContain(`/positionierungs-analyse/admin?range=all#lead-${lead.id}`);
  });
  it("swallows network failures without logging the error or URL", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendSlack("https://hooks.slack.com/services/test-only", TEST_MESSAGE, async () => { throw new Error("sensitive failure"); });
    expect(result).toBe(false);
    expect(log).toHaveBeenCalledWith("lead-slack-notify: Slack transport failed");
    log.mockRestore();
  });
  it("posts the test message without any lead payload", async () => {
    const request = vi.fn(async () => new Response("ok"));
    expect(await sendSlack("https://hooks.slack.com/services/test-only", TEST_MESSAGE, request)).toBe(true);
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(body.text).toBe("🧪 Test · Slack-Benachrichtigung Hub");
    expect(body.unfurl_links).toBe(false);
  });
});