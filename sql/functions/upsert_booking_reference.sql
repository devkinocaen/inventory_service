CREATE OR REPLACE FUNCTION inventory.upsert_booking_reference(
    p_name TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS inventory.booking_reference
LANGUAGE plpgsql
SECURITY DEFINER

AS $$
DECLARE
    ref inventory.booking_reference;
BEGIN
    -- Cherche si la référence existe déjà
    SELECT br.* INTO ref
    FROM inventory.booking_reference br
    WHERE br.name = p_name
    LIMIT 1;

    IF FOUND THEN
        -- Si existe, met à jour la description si fournie
        UPDATE inventory.booking_reference br
        SET description = COALESCE(p_description, br.description)
        WHERE br.id = ref.id
        RETURNING br.* INTO ref;
    ELSE
        -- Sinon, insère avec UPSERT
        INSERT INTO inventory.booking_reference(name, description)
        VALUES (p_name, p_description)
        ON CONFLICT (name)
        DO UPDATE SET
            description = COALESCE(EXCLUDED.description, inventory.booking_reference.description)
        RETURNING * INTO ref;
    END IF;

    RETURN ref;
END;
$$;
