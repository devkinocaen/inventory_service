CREATE OR REPLACE FUNCTION drop_functions_by_name(
    p_schema_name text,
    p_function_name text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = p_function_name
          AND n.nspname = p_schema_name
    LOOP
        EXECUTE format(
            'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
            r.schema_name,
            r.function_name,
            r.args
        );
    END LOOP;
END;
$$;
