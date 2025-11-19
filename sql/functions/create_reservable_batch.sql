CREATE OR REPLACE FUNCTION inventory.create_reservable_batch(
    p_description TEXT DEFAULT NULL,
    p_reservable_ids INT[] DEFAULT NULL
)
RETURNS inventory.reservable_batch
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_batch inventory.reservable_batch%ROWTYPE;
    v_id INT;
    r_item RECORD;
BEGIN
    -- 1) Création du batch avec description (vide si NULL)
    INSERT INTO inventory.reservable_batch (description)
    VALUES (COALESCE(p_description, ''))
    RETURNING * INTO new_batch;

    -- 2) Vérification + ajout des items
    IF p_reservable_ids IS NOT NULL THEN
        FOREACH v_id IN ARRAY p_reservable_ids LOOP

            -- Charger l’item
            SELECT id, name, status
            INTO r_item
            FROM inventory.reservable
            WHERE id = v_id;

            -- 2a) Vérifier que l’item existe
            IF r_item IS NULL THEN
                RAISE EXCEPTION
                    'Le réservable avec id=% n’existe pas dans la base.',
                    v_id;
            END IF;

            -- 2b) Vérifier que l’item est disponible
            IF r_item.status <> 'disponible' THEN
                RAISE EXCEPTION
                    'Le réservable "%" (id=%) est en statut "%", impossible de l’ajouter au batch.',
                    r_item.name, r_item.id, r_item.status;
            END IF;

            -- 2c) Ajouter au batch
            INSERT INTO inventory.reservable_batch_link (batch_id, reservable_id)
            VALUES (new_batch.id, v_id);

        END LOOP;
    END IF;

    RETURN new_batch;
END;
$$;
