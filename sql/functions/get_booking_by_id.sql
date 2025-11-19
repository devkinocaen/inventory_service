-- ========================================
-- Fonction : get_booking_by_id (JSONB “plat”)
-- ========================================
CREATE OR REPLACE FUNCTION inventory.get_booking_by_id(p_booking_id INT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    booking_rec RECORD;
    batch_rec RECORD;
BEGIN
    -- Récupération de la réservation
    SELECT b.*,
           br.name AS booking_reference_name,
           ro.name AS renter_organization_name,
           bp.first_name || ' ' || bp.last_name AS booking_person_name,
           pp.first_name || ' ' || pp.last_name AS pickup_person_name,
           rp.first_name || ' ' || rp.last_name AS return_person_name
    INTO booking_rec
    FROM inventory.reservable_booking b
    LEFT JOIN inventory.booking_reference br ON br.id = b.booking_reference_id
    LEFT JOIN inventory.organization ro ON ro.id = b.renter_organization_id
    LEFT JOIN inventory.person bp ON bp.id = b.booking_person_id
    LEFT JOIN inventory.person pp ON pp.id = b.pickup_person_id
    LEFT JOIN inventory.person rp ON rp.id = b.return_person_id
    WHERE b.id = p_booking_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Récupération du batch associé (si existant)
    SELECT id, description
    INTO batch_rec
    FROM inventory.reservable_batch
    WHERE id = booking_rec.reservable_batch_id;

    -- Retour JSON plat
    RETURN jsonb_build_object(
        'booking', jsonb_build_object(
            'id', booking_rec.id,
            'renter_organization_id', booking_rec.renter_organization_id,
            'renter_organization_name', booking_rec.renter_organization_name,
            'booking_person_id', booking_rec.booking_person_id,
            'booking_person_name', booking_rec.booking_person_name,
            'pickup_person_id', booking_rec.pickup_person_id,
            'pickup_person_name', booking_rec.pickup_person_name,
            'return_person_id', booking_rec.return_person_id,
            'return_person_name', booking_rec.return_person_name,
            'booking_reference_id', booking_rec.booking_reference_id,
            'booking_reference_name', booking_rec.booking_reference_name,
            'start_date', booking_rec.start_date,
            'end_date', booking_rec.end_date
        ),
        'batch', CASE
                    WHEN batch_rec.id IS NOT NULL THEN
                        jsonb_build_object(
                            'id', batch_rec.id,
                            'description', batch_rec.description
                        )
                    ELSE NULL
                 END
    );
END;
$$;
