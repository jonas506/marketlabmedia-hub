CREATE TABLE public.signature_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  file_hash text,
  file_size bigint,
  recipient_name text,
  recipient_email text NOT NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  subject text NOT NULL,
  message_body text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'draft',
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signature_documents_token ON public.signature_documents(token);
CREATE INDEX idx_signature_documents_created ON public.signature_documents(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_documents TO authenticated;
GRANT ALL ON public.signature_documents TO service_role;
ALTER TABLE public.signature_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage signature documents"
ON public.signature_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_signature_documents_updated_at
BEFORE UPDATE ON public.signature_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.signature_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  typed_name text NOT NULL,
  consent_text text NOT NULL,
  ip_address text,
  user_agent text,
  file_hash text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signature_acceptances_doc ON public.signature_acceptances(document_id);

GRANT SELECT ON public.signature_acceptances TO authenticated;
GRANT ALL ON public.signature_acceptances TO service_role;
ALTER TABLE public.signature_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read acceptances"
ON public.signature_acceptances FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));