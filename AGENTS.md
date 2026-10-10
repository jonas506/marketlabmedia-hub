# Architecture Rules

- Keep public marketing funnels isolated in their own page folder and scoped stylesheet so campaign styling cannot affect the internal hub.
- Keep positioning-form step validation in a shared pure helper so the three-step progression can be tested independently of presentation.
- Store anonymous funnel submissions in dedicated RLS-protected tables instead of granting anonymous access to internal CRM tables.- Funnel admin panels gate data via a DB security-definer email check (is_funnel_admin) in RLS, not only in the UI, so lead data stays protected server-side.
