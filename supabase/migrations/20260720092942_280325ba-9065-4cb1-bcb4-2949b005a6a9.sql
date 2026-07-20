
-- 1) CRM-Datenmodell verschlanken: 5 ungenutzte Nebentabellen entfernen
DROP TABLE IF EXISTS public.crm_smart_views CASCADE;
DROP TABLE IF EXISTS public.crm_opportunities CASCADE;
DROP TABLE IF EXISTS public.crm_notes CASCADE;
DROP TABLE IF EXISTS public.crm_emails CASCADE;
DROP TABLE IF EXISTS public.crm_contacts CASCADE;

-- 2) CRM-Kampagnen komplett raus (redundant zu marketing_tracking)
DROP TABLE IF EXISTS public.crm_campaign_entries CASCADE;
DROP TABLE IF EXISTS public.crm_campaigns CASCADE;

-- 3) task_comments raus (0 Zeilen, nie ernsthaft genutzt).
-- content_piece_comments (Kunden-Portal, RLS via Token-RPC) und
-- piece_internal_comments (interne Team-Kommentare mit @mentions) behalten wir bewusst
-- getrennt — Merge in eine generische Tabelle würde entweder RLS aufweichen oder
-- die Komplexität erhöhen statt reduzieren.
DROP TABLE IF EXISTS public.task_comments CASCADE;
