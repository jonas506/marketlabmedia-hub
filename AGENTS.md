# Architecture Rules

- Keep public marketing funnels isolated in their own page folder and scoped stylesheet so campaign styling cannot affect the internal hub.
- Keep positioning-form step validation in a shared pure helper so the three-step progression can be tested independently of presentation.
- Store anonymous funnel submissions in dedicated RLS-protected tables instead of granting anonymous access to internal CRM tables.- Funnel admin panels gate data via a DB security-definer email check (is_funnel_admin) in RLS, not only in the UI, so lead data stays protected server-side.
- External reporting endpoints (e.g. ads-stats) authenticate via a shared x-api-key secret, use service role server-side and return aggregate numbers only, so no personal data leaves the backend.
- Public funnel tracking (pixel, CAPI, funnel events, browser session ids) runs only behind the funnel-scoped consent check in tracking.ts, so nothing fires before opt-in (DSGVO/TTDSG).
- Funnel Slack delivery uses an AFTER INSERT pg_net callback with a single-use, service-role-only outbox capability; external requests happen after commit and test sends require the existing funnel-admin check, so neither browser lifetime nor Slack availability affects lead saving.
