-- ===========================================
-- Met à jour un batch et ses réservables
-- ===========================================
CREATE OR REPLACE FUNCTION inventory.update_batch(
    p_batch_id INT,
    p_description TEXT,
    p_reservable_ids INT[] DEFAULT NULL
)
RETURNS TABLE(
    id INT,
    description TEXT
) AS $$
BEGIN
    -- Vérifie que le vecteur n'est pas vide si non NULL
    IF p_reservable_ids IS NOT NULL AND array_length(p_reservable_ids, 1) = 0 THEN
        RAISE EXCEPTION 'Un batch doit contenir au moins un reservable';
    END IF;

    -- Met à jour la description du batch et récupère dans les variables de sortie
    UPDATE inventory.reservable_batch AS b
    SET description = p_description
    WHERE b.id = p_batch_id
    RETURNING b.id AS batch_id, b.description AS batch_description
    INTO id, description;

    -- Si des reservables sont fournis, on réinitialise les liens
    IF p_reservable_ids IS NOT NULL THEN
        DELETE FROM inventory.reservable_batch_link
        WHERE batch_id = p_batch_id;

        INSERT INTO inventory.reservable_batch_link(batch_id, reservable_id)
        SELECT p_batch_id, unnest(p_reservable_ids);
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
