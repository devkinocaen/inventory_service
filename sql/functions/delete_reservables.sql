CREATE OR REPLACE FUNCTION public.delete_reservables(
    p_ids INT[],
    p_force BOOLEAN DEFAULT false
) RETURNS TABLE(success BOOLEAN, warning TEXT) AS $$
BEGIN
    IF NOT p_force AND EXISTS (
        SELECT 1 FROM reservable_booking WHERE reservable_id = ANY(p_ids)
    ) THEN
        RETURN QUERY SELECT false AS success, 'Certains objets ont des réservations actives. Utilisez force pour supprimer.' AS warning;
        RETURN;
    END IF;

    DELETE FROM reservable_booking WHERE reservable_id = ANY(p_ids);
    DELETE FROM reservable WHERE id = ANY(p_ids);

    RETURN QUERY SELECT true AS success, NULL AS warning;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;