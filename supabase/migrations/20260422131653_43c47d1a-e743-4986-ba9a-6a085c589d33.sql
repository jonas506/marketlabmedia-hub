-- Auslagen / Spesen für Mitarbeiter (z.B. SD-Karten, Blumen, Büromaterial)
CREATE TABLE public.expense_reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  expense_date date NOT NULL,
  category text NOT NULL DEFAULT 'sonstiges',
  description text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  vendor text,
  receipt_url text,
  note text,
  status text NOT NULL DEFAULT 'draft', -- draft | submitted | approved
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_reimbursements_user_month ON public.expense_reimbursements(user_id, year, month);

ALTER TABLE public.expense_reimbursements ENABLE ROW LEVEL SECURITY;

-- Users can view their own; admin sees all
CREATE POLICY "Users view own expense_reimbursements"
ON public.expense_reimbursements FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own
CREATE POLICY "Users insert own expense_reimbursements"
ON public.expense_reimbursements FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own (drafts); admin can update any (e.g. approve)
CREATE POLICY "Users update own expense_reimbursements"
ON public.expense_reimbursements FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin update all expense_reimbursements"
ON public.expense_reimbursements FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can delete their own drafts; admin can delete any
CREATE POLICY "Users delete own expense_reimbursements"
ON public.expense_reimbursements FOR DELETE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Validation
CREATE OR REPLACE FUNCTION public.validate_expense_reimbursement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'submitted', 'approved') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.amount < 0 THEN
    RAISE EXCEPTION 'Amount must be non-negative';
  END IF;
  -- Auto-derive month/year from expense_date if not set correctly
  NEW.month := EXTRACT(MONTH FROM NEW.expense_date)::int;
  NEW.year := EXTRACT(YEAR FROM NEW.expense_date)::int;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_expense_reimbursement
BEFORE INSERT OR UPDATE ON public.expense_reimbursements
FOR EACH ROW EXECUTE FUNCTION public.validate_expense_reimbursement();

CREATE TRIGGER trg_expense_reimbursements_updated_at
BEFORE UPDATE ON public.expense_reimbursements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own expense receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own expense receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users can delete own expense receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);