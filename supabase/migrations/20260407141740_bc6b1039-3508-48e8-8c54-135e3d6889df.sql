CREATE OR REPLACE FUNCTION public.validate_time_entry_hours()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.hours <= 0 OR NEW.hours > 24 THEN
    RAISE EXCEPTION 'hours must be between 0 and 24';
  END IF;
  IF NEW.activity_type NOT IN ('scripting','editing','shooting','strategy','publishing','admin','meeting','research','content_creation','reporting','other') THEN
    RAISE EXCEPTION 'invalid activity_type: %', NEW.activity_type;
  END IF;
  IF NEW.entry_mode = 'time_range' AND (NEW.start_time IS NULL OR NEW.end_time IS NULL) THEN
    RAISE EXCEPTION 'start_time and end_time required for time_range mode';
  END IF;
  RETURN NEW;
END;
$$;