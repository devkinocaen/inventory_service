DO $$
DECLARE
  r RECORD;
BEGIN
  -- Supprimer toutes les fonctions dans le schéma public uniquement
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format(
        'DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;',
        r.proname,
        r.args
      );
      RAISE NOTICE 'Fonction % dropped.', r.proname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Impossible de drop %I(%s), ignoré.', r.proname, r.args;
    END;
  END LOOP;

  -- Supprimer tous les triggers dans le schéma public uniquement
  FOR r IN
    SELECT event_object_table AS tablename,
           trigger_name
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON public.%I CASCADE;',
        r.trigger_name,
        r.tablename
      );
      RAISE NOTICE 'Trigger % dropped.', r.trigger_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Impossible de drop trigger %I sur %I, ignoré.',
        r.trigger_name, r.tablename;
    END;
  END LOOP;
END
$$;
