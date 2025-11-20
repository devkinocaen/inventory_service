CREATE OR REPLACE FUNCTION inventory.generate_unique_id(p_table_name TEXT)
RETURNS INT AS $$
DECLARE
    new_id INT;
    id_exists BOOLEAN;
    col_count INT;
BEGIN
    -- Vérifie que la colonne 'id' existe
    SELECT COUNT(*)
    INTO col_count
    FROM information_schema.columns
    WHERE table_name = p_table_name
      AND column_name = 'id';

    IF col_count = 0 THEN
        RAISE EXCEPTION 'La table "%" n''a pas de colonne "id"', p_table_name;
    END IF;

    LOOP
        -- Génère un ID aléatoire
        new_id := FLOOR(random() * 1000000)::INT;

        -- Vérifie s'il existe déjà
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1)', p_table_name)
        INTO id_exists
        USING new_id;

        -- Si pas existant, on sort de la boucle
        IF NOT id_exists THEN
            RETURN new_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
