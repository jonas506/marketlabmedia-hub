CREATE OR REPLACE FUNCTION public.validate_vacation_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type NOT IN ('vacation', 'sick', 'personal', 'holiday') THEN
    RAISE EXCEPTION 'Invalid vacation type: %', NEW.type;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  RETURN NEW;
END;
$function$;