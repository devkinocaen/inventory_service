CREATE OR REPLACE FUNCTION inventory.create_booking(
    p_reservable_batch_id    INTEGER,
    p_renter_organization_id INTEGER,
    p_booking_person_id      INTEGER,
    p_start_date             TIMESTAMP,
    p_end_date               TIMESTAMP,
    p_pickup_person_id       INTEGER DEFAULT NULL,
    p_booking_reference_id   INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id                     INTEGER,
    reservable_batch_id    INTEGER,
    renter_organization_id INTEGER,
    booking_person_id      INTEGER,
    pickup_person_id       INTEGER,
    return_person_id       INTEGER,
    booking_reference_id   INTEGER,
    start_date             TIMESTAMP,
    end_date               TIMESTAMP,
    period                 TEXT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO inventory.reservable_booking (
        reservable_batch_id,
        renter_organization_id,
        booking_person_id,
        pickup_person_id,
        return_person_id,
        start_date,
        end_date,
        booking_reference_id
    )
    VALUES (
        p_reservable_batch_id,
        p_renter_organization_id,
        p_booking_person_id,
        p_pickup_person_id,
        NULL,
        p_start_date,
        p_end_date,
        p_booking_reference_id
    )
    RETURNING
        reservable_booking.id,
        reservable_booking.reservable_batch_id,
        reservable_booking.renter_organization_id,
        reservable_booking.booking_person_id,
        reservable_booking.pickup_person_id,
        reservable_booking.return_person_id,
        reservable_booking.booking_reference_id,
        reservable_booking.start_date,
        reservable_booking.end_date,
        tsrange(reservable_booking.start_date, reservable_booking.end_date)::text AS period;

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
