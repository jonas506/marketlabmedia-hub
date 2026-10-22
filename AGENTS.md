# Architecture Rules
- Storage policies resolve board folders through strategy_boards and require a non-null client ID before cutter has_client_access checks; receipts use staff-owner folders, not client folders.
- Public media buckets retain public object delivery but not anonymous listing; private referral downloads are limited to assets referenced by active referral pages.
- Persist CRM file paths and create short-lived signed URLs at download time, accepting legacy stored URLs through the shared path parser.
- Share acceptance validation, payment labels and Berlin end-of-day deadlines between public offer/document handlers and the UI so legal acceptance rules cannot diverge.
- Extract uploaded offer totals and validity only from explicit first-page PDF lines; do not guess totals from the largest amount.

- Keep public marketing funnels isolated in their own page folder and scoped stylesheet so campaign styling cannot affect the internal hub.
- Keep positioning-form step validation in a shared pure helper so the three-step progression can be tested independently of presentation.
- Store anonymous funnel submissions in dedicated RLS-protected tables instead of granting anonymous access to internal CRM tables.- Funnel admin panels gate data via a DB security-definer email check (is_funnel_admin) in RLS, not only in the UI, so lead data stays protected server-side.
- External reporting endpoints (e.g. ads-stats) authenticate via a shared x-api-key secret, use service role server-side and return aggregate numbers only, so no personal data leaves the backend.
- Public funnel tracking (pixel, CAPI, funnel events, browser session ids) runs only behind the funnel-scoped consent check in tracking.ts, so nothing fires before opt-in (DSGVO/TTDSG).
- CRM contact matching/upsert lives only in DB functions (crm_match_contact, crm_upsert_contact, crm_merge_contacts) so the crm-api function, CSV import and lead trigger share one dedupe rule.
