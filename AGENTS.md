# Architecture Rules

- Keep public marketing funnels isolated in their own page folder and scoped stylesheet so campaign styling cannot affect the internal hub.
- Store anonymous funnel submissions in dedicated RLS-protected tables instead of granting anonymous access to internal CRM tables.