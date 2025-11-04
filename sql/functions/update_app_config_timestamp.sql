CREATE OR REPLACE FUNCTION public.update_app_config_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE AS $$
BEGIN
  UPDATE app_config
  SET updated_at = NOW()
  WHERE id = 1;  -- id fixe
  RETURN NULL;   -- AFTER trigger
END;
$$;
