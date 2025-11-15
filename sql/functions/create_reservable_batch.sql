CREATE OR REPLACE FUNCTION inventory.create_reservable_batch(
    p_reservable_ids INT[]
)
RETURNS inventory.reservable_batch
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_batch inventory.reservable_batch%ROWTYPE;
    id INT;
BEGIN
    -- 1) Créer le batch
    INSERT INTO inventory.reservable_batch (description)
    VALUES ('')
    RETURNING * INTO new_batch;

    -- 2) Valider chaque item et l’ajouter au batch
    IF p_reservable_ids IS NOT NULL THEN
        FOREACH id IN ARRAY p_reservable_ids LOOP
            
            -- vérification existence
            PERFORM 1 FROM inventory.reservable WHERE reservable.id = id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservable % n’existe pas', id;
            END IF;

            -- insertion dans le lien batch <-> item
            INSERT INTO inventory.reservable_batch_link (batch_id, reservable_id)
            VALUES (new_batch.id, id);

        END LOOP;
    END IF;

    RETURN new_batch;
END;
$$;
