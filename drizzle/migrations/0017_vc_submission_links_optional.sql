ALTER TABLE public.vertriebs_check_submissions ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE public.vertriebs_check_submissions ALTER COLUMN lead_id DROP NOT NULL;
COMMENT ON COLUMN public.vertriebs_check_submissions.contact_id IS 'Wird erst nach der CRM-Synchronisation gesetzt';
COMMENT ON COLUMN public.vertriebs_check_submissions.lead_id IS 'Wird erst nach der CRM-Synchronisation gesetzt';