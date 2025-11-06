-- Fonction PL/pgSQL pour réaligner toutes les séquences du schéma inventory
-- Paramètre : p_role (texte, optionnel, pour contexte/logs)
CREATE OR REPLACE FUNCTION inventory.realign_serials(p_role text DEFAULT 'anonymous')
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
          AND table_schema = 'inventory'
    LOOP
        -- Récupérer la séquence associée
        seq_label := pg_get_serial_sequence('inventory.' || r.table_name, r.column_name);

        IF seq_label IS NULL AND r.column_default IS NOT NULL THEN
            BEGIN
                seq_label := regexp_replace(r.column_default, '^nextval\(''([^'']+)''.*$', '\1');
            EXCEPTION WHEN OTHERS THEN
                seq_label := NULL;
            END;
        END IF;

        IF seq_label IS NULL THEN
            RAISE NOTICE 'SKIP: pas de séquence détectée pour inventory.% column %', r.table_name, r.column_name;
            CONTINUE;
        END IF;

        -- Calculer la valeur max de la colonne
        EXECUTE format('SELECT COALESCE(MAX(%I),0), COUNT(*) FROM inventory.%I', r.column_name, r.table_name)
        INTO max_val, nb_rows;

        -- Vérifier que la séquence existe
        BEGIN
            seq_reg := ('inventory.' || seq_label)::regclass;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'SKIP: sequence % introuvable en tant que regclass', seq_label;
            CONTINUE;
        END;

        -- Ajuster la valeur max si nécessaire
        IF max_val < nb_rows THEN
            max_val := nb_rows;
        END IF;

        -- Construire la commande setval
        IF max_val = 0 THEN
            cmd := format('SELECT setval(%L, 1, false)', seq_label);
        ELSE
            cmd := format('SELECT setval(%L, %s, true)', seq_label, max_val);
        END IF;

        EXECUTE cmd;
        RAISE NOTICE 'Command executed: %', cmd;

        -- Vérifier le last_value
        EXECUTE format('SELECT last_value FROM %I', seq_label) INTO seq_last;
        IF seq_last < nb_rows THEN
            RAISE EXCEPTION 'Séquence % mal alignée pour table inventory.% : last_value = %, nb_rows = %',
                seq_label, r.table_name, seq_last, nb_rows;
        ELSE
            RAISE NOTICE 'Séquence % OK pour table inventory.% : last_value = %, nb_rows = %',
                seq_label, r.table_name, seq_last, nb_rows;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
