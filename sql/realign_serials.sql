-- Fonction PL/pgSQL pour réaligner toutes les séquences du schéma public
-- Paramètre : p_role (texte, optionnel, pour contexte/logs)
CREATE OR REPLACE FUNCTION public.realign_serials(p_role text DEFAULT 'anonymous')
RETURNS void AS $$
DECLARE
    r RECORD;
    seq_label text;
    seq_reg regclass;
    max_val bigint;
    nb_rows bigint;
    seq_last bigint;
    cmd text;
BEGIN
    RAISE NOTICE 'Execution of realign_serials() as role: %', p_role;

    FOR r IN
        SELECT table_name, column_name, column_default, is_identity
        FROM information_schema.columns
        WHERE (column_default LIKE 'nextval(%' OR is_identity = 'YES')
          AND table_schema = 'public'
    LOOP
        seq_label := pg_get_serial_sequence(r.table_name, r.column_name);

        IF seq_label IS NULL AND r.column_default IS NOT NULL THEN
            BEGIN
                seq_label := regexp_replace(r.column_default, '^nextval\(''([^'']+)''.*$', '\1');
            EXCEPTION WHEN OTHERS THEN
                seq_label := NULL;
            END;
        END IF;

        IF seq_label IS NULL THEN
            RAISE NOTICE 'SKIP: pas de séquence détectée pour public.% column %', r.table_name, r.column_name;
            CONTINUE;
        END IF;

        EXECUTE format('SELECT COALESCE(MAX(%I),0), COUNT(*) FROM public.%I', r.column_name, r.table_name)
        INTO max_val, nb_rows;

        BEGIN
            seq_reg := seq_label::regclass;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'SKIP: sequence % introuvable en tant que regclass', seq_label;
            CONTINUE;
        END;

        IF max_val < nb_rows THEN
            max_val := nb_rows;
        END IF;

        IF max_val = 0 THEN
            cmd := 'SELECT setval(' || quote_literal(seq_label) || ', 1, false)';
        ELSE
            cmd := 'SELECT setval(' || quote_literal(seq_label) || ', ' || max_val || ', true)';
        END IF;

        EXECUTE cmd;
        RAISE NOTICE 'Command executed: %', cmd;

        EXECUTE 'SELECT last_value FROM ' || seq_label INTO seq_last;
        IF seq_last < nb_rows THEN
            RAISE EXCEPTION 'Séquence % mal alignée pour table public.% : last_value = %, nb_rows = %',
                seq_label, r.table_name, seq_last, nb_rows;
        ELSE
            RAISE NOTICE 'Séquence % OK pour table public.% : last_value = %, nb_rows = %',
                seq_label, r.table_name, seq_last, nb_rows;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
