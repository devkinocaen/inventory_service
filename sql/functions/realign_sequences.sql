CREATE OR REPLACE FUNCTION inventory.realign_sequences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = inventory, public
AS $$
DECLARE
    rec RECORD;
    seq_fq TEXT;
    max_id BIGINT;
BEGIN
    FOR rec IN
        SELECT
            c.relname AS table_name,
            a.attname AS column_name,
            s.relname AS sequence_name
        FROM pg_class s
        JOIN pg_depend d ON d.objid = s.oid
        JOIN pg_class c ON d.refobjid = c.oid
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.refobjsubid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE s.relkind = 'S'
          AND n.nspname = 'inventory'
    LOOP
        seq_fq := format('inventory.%I', rec.sequence_name);

        EXECUTE format(
            'SELECT MAX(%I) FROM inventory.%I',
            rec.column_name,
            rec.table_name
        ) INTO max_id;

        IF max_id IS NULL THEN
            max_id := 1;
        END IF;

        RAISE NOTICE 'Realigning sequence % to %', seq_fq, max_id;

        EXECUTE format(
            'SELECT setval(%L, %s, true)',
            seq_fq,
            max_id
        );
    END LOOP;
END;
$$;
