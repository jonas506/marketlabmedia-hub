-- contracts
CREATE TABLE public.client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  duration_months integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_contracts_client ON public.client_contracts(client_id);

ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contracts" ON public.client_contracts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_client_contracts_updated
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- contract months
CREATE TABLE public.client_contract_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.client_contracts(id) ON DELETE CASCADE,
  month_number integer NOT NULL,
  billing_month integer NOT NULL,
  billing_year integer NOT NULL,
  amount_netto numeric(10,2) NOT NULL,
  invoice_status text NOT NULL DEFAULT 'upcoming',
  invoice_sent_at date,
  invoice_paid_at date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, month_number)
);

CREATE INDEX idx_contract_months_contract ON public.client_contract_months(contract_id);

ALTER TABLE public.client_contract_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contract months" ON public.client_contract_months
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_client_contract_months_updated
  BEFORE UPDATE ON public.client_contract_months
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- projects
CREATE TABLE public.client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_netto numeric(10,2) NOT NULL,
  invoice_status text NOT NULL DEFAULT 'upcoming',
  due_date date,
  invoice_sent_at date,
  invoice_paid_at date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_projects_client ON public.client_projects(client_id);

ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client projects" ON public.client_projects
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_client_projects_updated
  BEFORE UPDATE ON public.client_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- validation triggers
CREATE OR REPLACE FUNCTION public.validate_client_contract()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid contract status: %', NEW.status;
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date must be >= start_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_client_contract
  BEFORE INSERT OR UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_contract();

CREATE OR REPLACE FUNCTION public.validate_contract_month()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.invoice_status NOT IN ('upcoming','due','sent','paid','overdue') THEN
    RAISE EXCEPTION 'Invalid invoice_status: %', NEW.invoice_status;
  END IF;
  IF NEW.billing_month < 1 OR NEW.billing_month > 12 THEN
    RAISE EXCEPTION 'billing_month must be 1-12';
  END IF;
  IF NEW.amount_netto < 0 THEN
    RAISE EXCEPTION 'amount_netto must be >= 0';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_contract_month
  BEFORE INSERT OR UPDATE ON public.client_contract_months
  FOR EACH ROW EXECUTE FUNCTION public.validate_contract_month();

CREATE OR REPLACE FUNCTION public.validate_client_project()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.invoice_status NOT IN ('upcoming','sent','paid') THEN
    RAISE EXCEPTION 'Invalid invoice_status: %', NEW.invoice_status;
  END IF;
  IF NEW.amount_netto < 0 THEN
    RAISE EXCEPTION 'amount_netto must be >= 0';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_client_project
  BEFORE INSERT OR UPDATE ON public.client_projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_project();

-- auto-complete contract when all months paid
CREATE OR REPLACE FUNCTION public.maybe_complete_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_unpaid integer;
BEGIN
  IF NEW.invoice_status = 'paid' THEN
    SELECT count(*) INTO v_unpaid FROM public.client_contract_months
      WHERE contract_id = NEW.contract_id AND invoice_status <> 'paid';
    IF v_unpaid = 0 THEN
      UPDATE public.client_contracts SET status = 'completed'
      WHERE id = NEW.contract_id AND status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maybe_complete_contract
  AFTER UPDATE OF invoice_status ON public.client_contract_months
  FOR EACH ROW EXECUTE FUNCTION public.maybe_complete_contract();