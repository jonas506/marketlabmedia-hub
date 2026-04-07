
ALTER TABLE public.time_entries 
ADD COLUMN entry_mode text NOT NULL DEFAULT 'duration',
ADD COLUMN start_time time WITHOUT TIME ZONE,
ADD COLUMN end_time time WITHOUT TIME ZONE;

-- Update the validation trigger to allow new activity types and not block time_range entries
CREATE OR REPLACE FUNCTION public.validate_time_entry_hours()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.hours <= 0 OR NEW.hours > 24 THEN
    RAISE EXCEPTION 'Hours must be between 0 and 24';
  END IF;
  IF NEW.activity_type NOT IN ('scripting', 'editing', 'shooting', 'strategy', 'publishing', 'admin', 'meeting', 'other', 'research', 'content_creation') THEN
    RAISE EXCEPTION 'Invalid activity_type: %', NEW.activity_type;
  END IF;
  IF NEW.entry_mode NOT IN ('duration', 'time_range') THEN
    RAISE EXCEPTION 'Invalid entry_mode: %', NEW.entry_mode;
  END IF;
  IF NEW.entry_mode = 'time_range' AND (NEW.start_time IS NULL OR NEW.end_time IS NULL) THEN
    RAISE EXCEPTION 'start_time and end_time required for time_range mode';
  END IF;
  RETURN NEW;
END;
$function$;
