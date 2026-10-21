CREATE TYPE public.crm_segment AS ENUM ('immo_finanz','mittelstand','kunde','partner','creator','sonstiges');
CREATE TYPE public.crm_relationship AS ENUM ('kunde','lead','netzwerk','event_kontakt','partner','team','kalt');
CREATE TYPE public.crm_channel AS ENUM ('whatsapp','linkedin','mail','instagram','telefon','brief','persoenlich');
CREATE TYPE public.crm_guest_status AS ENUM ('angefragt','eingeladen','vielleicht','zusage','spaeter','absage','bounce','erschienen');
CREATE TYPE public.crm_event_status AS ENUM ('geplant','aktiv','vorbei');

ALTER TYPE public.crm_activity_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE public.crm_activity_type ADD VALUE IF NOT EXISTS 'linkedin';
ALTER TYPE public.crm_activity_type ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE public.crm_activity_type ADD VALUE IF NOT EXISTS 'brief';
ALTER TYPE public.crm_activity_type ADD VALUE IF NOT EXISTS 'event';

CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  first_name text, company text, role text, email text, phone text, whatsapp text,
  linkedin_url text, instagram_handle text, website text, city text, region text,
  segment public.crm_segment NOT NULL DEFAULT 'sonstiges',
  relationship public.crm_relationship NOT NULL DEFAULT 'lead',
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  last_contact_at timestamptz,
  last_channel public.crm_channel,
  next_followup_date date,
  notes text,
  do_not_contact boolean NOT NULL DEFAULT false,
  lat double precision, lon double precision,
  external_ref text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX crm_contacts_email_idx ON public.crm_contacts (lower(email));
CREATE INDEX crm_contacts_linkedin_idx ON public.crm_contacts (lower(linkedin_url));
CREATE INDEX crm_contacts_name_idx ON public.crm_contacts (lower(full_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_contacts" ON public.crm_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  date date, start_time text, location text,
  price_net numeric NOT NULL DEFAULT 0,
  capacity integer,
  landing_url text, description text,
  status public.crm_event_status NOT NULL DEFAULT 'geplant',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_events TO authenticated;
GRANT ALL ON public.crm_events TO service_role;
ALTER TABLE public.crm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_events" ON public.crm_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.crm_event_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.crm_events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  status public.crm_guest_status NOT NULL DEFAULT 'eingeladen',
  invited_via public.crm_channel,
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  plus_ones integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_event_guests TO authenticated;
GRANT ALL ON public.crm_event_guests TO service_role;
ALTER TABLE public.crm_event_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_event_guests" ON public.crm_event_guests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.crm_leads ADD COLUMN contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_activities ADD CONSTRAINT crm_activities_contact_fk FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tasks ADD CONSTRAINT crm_tasks_contact_fk FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_pipelines ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

-- Matching: external_ref -> email -> linkedin -> phone/whatsapp -> name+company
CREATE OR REPLACE FUNCTION public.crm_match_contact(_ref text, _email text, _linkedin text, _phone text, _name text, _company text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; p text := nullif(regexp_replace(coalesce(_phone,''),'\D','','g'),'');
BEGIN
  IF nullif(_ref,'') IS NOT NULL THEN SELECT id INTO v FROM crm_contacts WHERE external_ref = _ref LIMIT 1; IF v IS NOT NULL THEN RETURN v; END IF; END IF;
  IF nullif(_email,'') IS NOT NULL THEN SELECT id INTO v FROM crm_contacts WHERE lower(email) = lower(trim(_email)) ORDER BY created_at LIMIT 1; IF v IS NOT NULL THEN RETURN v; END IF; END IF;
  IF nullif(_linkedin,'') IS NOT NULL THEN SELECT id INTO v FROM crm_contacts WHERE lower(rtrim(linkedin_url,'/')) = lower(rtrim(trim(_linkedin),'/')) ORDER BY created_at LIMIT 1; IF v IS NOT NULL THEN RETURN v; END IF; END IF;
  IF p IS NOT NULL AND length(p) >= 6 THEN SELECT id INTO v FROM crm_contacts WHERE regexp_replace(coalesce(phone,''),'\D','','g') = p OR regexp_replace(coalesce(whatsapp,''),'\D','','g') = p ORDER BY created_at LIMIT 1; IF v IS NOT NULL THEN RETURN v; END IF; END IF;
  IF nullif(_name,'') IS NOT NULL THEN SELECT id INTO v FROM crm_contacts WHERE lower(full_name) = lower(trim(_name)) AND lower(coalesce(company,'')) = lower(coalesce(trim(_company),'')) ORDER BY created_at LIMIT 1; END IF;
  RETURN v;
END $$;

-- Upsert one contact from JSON; only non-empty values overwrite; tags merged.
CREATE OR REPLACE FUNCTION public.crm_upsert_contact(_c jsonb, _created_by uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; n text := nullif(trim(_c->>'full_name'),''); t text[];
  f text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT coalesce(array_agg(DISTINCT trim(x)) FILTER (WHERE trim(x) <> ''), '{}') INTO t FROM jsonb_array_elements_text(coalesce(_c->'tags','[]'::jsonb)) x;
  v := crm_match_contact(_c->>'external_ref', _c->>'email', _c->>'linkedin_url', coalesce(nullif(_c->>'phone',''), _c->>'whatsapp'), n, _c->>'company');
  IF v IS NULL THEN
    IF n IS NULL THEN RAISE EXCEPTION 'full_name required'; END IF;
    INSERT INTO crm_contacts (full_name, first_name, company, role, email, phone, whatsapp, linkedin_url, instagram_handle, website, city, region, segment, relationship, tags, source, last_contact_at, last_channel, next_followup_date, notes, do_not_contact, lat, lon, external_ref, created_by)
    VALUES (n, nullif(_c->>'first_name',''), nullif(_c->>'company',''), nullif(_c->>'role',''), nullif(trim(_c->>'email'),''), nullif(_c->>'phone',''), nullif(_c->>'whatsapp',''), nullif(_c->>'linkedin_url',''), nullif(_c->>'instagram_handle',''), nullif(_c->>'website',''), nullif(_c->>'city',''), nullif(_c->>'region',''),
      coalesce(nullif(_c->>'segment','')::crm_segment, 'sonstiges'), coalesce(nullif(_c->>'relationship','')::crm_relationship, 'lead'), t, nullif(_c->>'source',''),
      nullif(_c->>'last_contact_at','')::timestamptz, nullif(_c->>'last_channel','')::crm_channel, nullif(_c->>'next_followup_date','')::date, nullif(_c->>'notes',''),
      coalesce((_c->>'do_not_contact')::boolean, false), nullif(_c->>'lat','')::float8, nullif(_c->>'lon','')::float8, nullif(_c->>'external_ref',''), coalesce(_created_by, auth.uid()))
    RETURNING id INTO v;
    RETURN jsonb_build_object('id', v, 'status', 'created');
  END IF;
  UPDATE crm_contacts SET
    full_name = coalesce(n, full_name),
    first_name = coalesce(nullif(_c->>'first_name',''), first_name),
    company = coalesce(nullif(_c->>'company',''), company),
    role = coalesce(nullif(_c->>'role',''), role),
    email = coalesce(nullif(trim(_c->>'email'),''), email),
    phone = coalesce(nullif(_c->>'phone',''), phone),
    whatsapp = coalesce(nullif(_c->>'whatsapp',''), whatsapp),
    linkedin_url = coalesce(nullif(_c->>'linkedin_url',''), linkedin_url),
    instagram_handle = coalesce(nullif(_c->>'instagram_handle',''), instagram_handle),
    website = coalesce(nullif(_c->>'website',''), website),
    city = coalesce(nullif(_c->>'city',''), city),
    region = coalesce(nullif(_c->>'region',''), region),
    segment = coalesce(nullif(_c->>'segment','')::crm_segment, segment),
    relationship = coalesce(nullif(_c->>'relationship','')::crm_relationship, relationship),
    tags = (SELECT coalesce(array_agg(DISTINCT x), '{}') FROM unnest(tags || t) x),
    source = coalesce(nullif(_c->>'source',''), source),
    last_contact_at = coalesce(nullif(_c->>'last_contact_at','')::timestamptz, last_contact_at),
    last_channel = coalesce(nullif(_c->>'last_channel','')::crm_channel, last_channel),
    next_followup_date = coalesce(nullif(_c->>'next_followup_date','')::date, next_followup_date),
    notes = coalesce(nullif(_c->>'notes',''), notes),
    do_not_contact = coalesce((_c->>'do_not_contact')::boolean, do_not_contact),
    lat = coalesce(nullif(_c->>'lat','')::float8, lat),
    lon = coalesce(nullif(_c->>'lon','')::float8, lon),
    external_ref = coalesce(external_ref, nullif(_c->>'external_ref',''))
  WHERE id = v;
  RETURN jsonb_build_object('id', v, 'status', 'updated');
END $$;
REVOKE ALL ON FUNCTION public.crm_upsert_contact(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_upsert_contact(jsonb, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_match_contact(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_match_contact(text,text,text,text,text,text) TO authenticated, service_role;

-- Auto-link/create contact when a lead is inserted without contact_id
CREATE OR REPLACE FUNCTION public.crm_lead_link_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_person boolean := nullif(trim(NEW.contact_name),'') IS NOT NULL; nm text; co text;
BEGIN
  IF NEW.contact_id IS NOT NULL THEN RETURN NEW; END IF;
  nm := CASE WHEN has_person THEN trim(NEW.contact_name) ELSE NEW.name END;
  co := CASE WHEN has_person AND NEW.name IS DISTINCT FROM NEW.contact_name THEN NEW.name END;
  NEW.contact_id := crm_match_contact(NULL, NEW.contact_email, NEW.linkedin_url, NEW.contact_phone, nm, co);
  IF NEW.contact_id IS NULL AND nm IS NOT NULL THEN
    INSERT INTO crm_contacts (full_name, company, email, phone, linkedin_url, instagram_handle, website, source, relationship, created_by)
    VALUES (nm, co, nullif(NEW.contact_email,''), nullif(NEW.contact_phone,''), nullif(NEW.linkedin_url,''), nullif(NEW.instagram_handle,''), nullif(NEW.website,''), NEW.source, 'lead', NEW.created_by)
    RETURNING id INTO NEW.contact_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_leads_link_contact BEFORE INSERT ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.crm_lead_link_contact();

-- Merge two contacts (keep _keep, remove _drop)
CREATE OR REPLACE FUNCTION public.crm_merge_contacts(_keep uuid, _drop uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d crm_contacts;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _keep = _drop THEN RETURN; END IF;
  SELECT * INTO d FROM crm_contacts WHERE id = _drop;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE crm_leads SET contact_id = _keep WHERE contact_id = _drop;
  UPDATE crm_activities SET contact_id = _keep WHERE contact_id = _drop;
  UPDATE crm_tasks SET contact_id = _keep WHERE contact_id = _drop;
  UPDATE crm_event_guests g SET contact_id = _keep WHERE contact_id = _drop
    AND NOT EXISTS (SELECT 1 FROM crm_event_guests k WHERE k.event_id = g.event_id AND k.contact_id = _keep);
  DELETE FROM crm_event_guests WHERE contact_id = _drop;
  UPDATE crm_contacts c SET
    first_name = coalesce(c.first_name, d.first_name), company = coalesce(c.company, d.company), role = coalesce(c.role, d.role),
    email = coalesce(c.email, d.email), phone = coalesce(c.phone, d.phone), whatsapp = coalesce(c.whatsapp, d.whatsapp),
    linkedin_url = coalesce(c.linkedin_url, d.linkedin_url), instagram_handle = coalesce(c.instagram_handle, d.instagram_handle),
    website = coalesce(c.website, d.website), city = coalesce(c.city, d.city), region = coalesce(c.region, d.region),
    tags = (SELECT coalesce(array_agg(DISTINCT x), '{}') FROM unnest(c.tags || d.tags) x),
    source = coalesce(c.source, d.source),
    last_contact_at = greatest(c.last_contact_at, d.last_contact_at),
    last_channel = CASE WHEN d.last_contact_at > coalesce(c.last_contact_at, '-infinity') THEN d.last_channel ELSE c.last_channel END,
    next_followup_date = coalesce(c.next_followup_date, d.next_followup_date),
    notes = nullif(concat_ws(E'\n\n', c.notes, d.notes), ''),
    do_not_contact = c.do_not_contact OR d.do_not_contact,
    lat = coalesce(c.lat, d.lat), lon = coalesce(c.lon, d.lon),
    external_ref = coalesce(c.external_ref, CASE WHEN d.external_ref IS NOT NULL THEN NULL END)
  WHERE c.id = _keep;
  DELETE FROM crm_contacts WHERE id = _drop;
END $$;
REVOKE ALL ON FUNCTION public.crm_merge_contacts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_merge_contacts(uuid, uuid) TO authenticated, service_role;

-- Backfill: one contact per existing lead with contact_name (deduplicated via matching)
DO $$
DECLARE r record; v uuid; co text;
BEGIN
  FOR r IN SELECT * FROM public.crm_leads WHERE nullif(trim(contact_name),'') IS NOT NULL AND contact_id IS NULL ORDER BY created_at LOOP
    co := CASE WHEN r.name IS DISTINCT FROM r.contact_name THEN r.name END;
    v := public.crm_match_contact(NULL, r.contact_email, r.linkedin_url, r.contact_phone, trim(r.contact_name), co);
    IF v IS NULL THEN
      INSERT INTO public.crm_contacts (full_name, company, email, phone, linkedin_url, instagram_handle, website, source, relationship, created_by, created_at)
      VALUES (trim(r.contact_name), co, nullif(r.contact_email,''), nullif(r.contact_phone,''), nullif(r.linkedin_url,''), nullif(r.instagram_handle,''), nullif(r.website,''), r.source,
        CASE WHEN r.stage LIKE 'gewonnen%' THEN 'kunde'::public.crm_relationship ELSE 'lead' END, r.created_by, r.created_at)
      RETURNING id INTO v;
    END IF;
    UPDATE public.crm_leads SET contact_id = v WHERE id = r.id;
  END LOOP;
END $$;