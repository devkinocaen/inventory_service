DO $$
DECLARE
    r RECORD;
BEGIN
    -- Vérification table temporaire CSV
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = 'persons_temp_raw'
    ) THEN
        RAISE EXCEPTION 'La table persons_temp_raw n''existe pas. Charger le CSV avant.';
    END IF;

    -- Boucle sur la table temporaire
    FOR r IN SELECT * FROM persons_temp_raw LOOP

        -- Ignorer si déjà présent (même logique que reservables)
        IF EXISTS (
            SELECT 1
            FROM inventory.person
            WHERE first_name = trim(r.first_name)
              AND last_name  = trim(r.last_name)
        ) THEN
            CONTINUE;
        END IF;

        -- Insertion finale
        INSERT INTO inventory.person (
            first_name,
            last_name,
            email,
            phone
        )
        VALUES (
            trim(r.first_name),
            trim(r.last_name),
            NULLIF(trim(r.email), ''),
            NULLIF(trim(r.phone), '')
        )
        ON CONFLICT (first_name, last_name) DO NOTHING;

    END LOOP;

    -- Réaligner la séquence
    PERFORM setval(
        pg_get_serial_sequence('inventory.person','id'),
        GREATEST((SELECT COALESCE(MAX(id),0) FROM inventory.person), 1),
        true
    );

    -- Supprimer la table temporaire
    DROP TABLE IF EXISTS persons_temp_raw;

END;
$$ LANGUAGE plpgsql;
