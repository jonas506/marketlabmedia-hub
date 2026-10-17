export type NotificationLead = {
  id: string;
  contact_name: string | null;
  company: string | null;
  industry: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
};

// Never allow user input to introduce Slack mentions, links or multiline markup.
function safe(value: string | null): string {
  return (value ?? "").replace(/[\r\n\t]/g, " ").replace(/[<>*&]/g, "").trim().slice(0, 200);
}

export function buildLeadMessage(lead: NotificationLead): string {
  const firstName = safe(lead.contact_name?.trim().split(/\s+/)[0] ?? null);
  const context = [safe(lead.company), safe(lead.industry)].filter(Boolean).join(" · ");
  const source = [safe(lead.utm_source), safe(lead.utm_campaign), safe(lead.utm_content)].filter(Boolean).join(" / ") || "direkt/organisch";
  const timestamp = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short",
  }).format(new Date(lead.created_at));
  return [
    "🟢 *Neuer Lead · Positionierungs-Analyse*",
    [firstName, context].filter(Boolean).join(" · "),
    `Quelle: ${source}`,
    `${timestamp} (Europe/Berlin)`,
    `<https://hub.marketlab-media.de/positionierungs-analyse/admin?range=all#lead-${lead.id}|Lead im Admin-Bereich öffnen>`,
  ].filter(Boolean).join("\n");
}

export const TEST_MESSAGE = "🧪 Test · Slack-Benachrichtigung Hub";

export async function sendSlack(webhook: string, text: string, request: typeof fetch = fetch): Promise<boolean> {
  try {
    const url = new URL(webhook);
    if (url.protocol !== "https:" || url.hostname !== "hooks.slack.com" || !url.pathname.startsWith("/services/") || url.username || url.password) {
      console.error("lead-slack-notify: invalid webhook configuration");
      return false;
    }
    const response = await request(webhook, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(5000), redirect: "error",
    });
    if (!response.ok) {
      // Never log URL, response body, lead content or exception objects.
      console.error("lead-slack-notify: Slack delivery failed", response.status);
      return false;
    }
    return true;
  } catch {
    console.error("lead-slack-notify: Slack transport failed");
    return false;
  }
}