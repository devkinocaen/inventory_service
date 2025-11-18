CREATE OR REPLACE FUNCTION inventory.create_reservable_batch(
    p_reservable_ids INT[]
)
RETURNS inventory.reservable_batch
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_batch inventory.reservable_batch%ROWTYPE;
    v_id INT;
BEGIN
    -- 1) Création du batch
    INSERT INTO inventory.reservable_batch (description)
    VALUES ('')
    RETURNING * INTO new_batch;

    -- 2) Vérification + ajout des items
    IF p_reservable_ids IS NOT NULL THEN
        FOREACH v_id IN ARRAY p_reservable_ids LOOP

            -- Vérification disponibilité
            PERFORM 1
            FROM inventory.reservable r
            WHERE r.id = v_id
              AND r.status = 'disponible';

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'Reservable % n’est pas disponible, impossible de le mettre dans un batch.',
                    v_id;
            END IF;

            -- Insertion dans le lien
            INSERT INTO inventory.reservable_batch_link (batch_id, reservable_id)
            VALUES (new_batch.id, v_id);

        END LOOP;
    END IF;

    RETURN new_batch;
END;
$$;
