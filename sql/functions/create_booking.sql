CREATE OR REPLACE FUNCTION inventory.create_booking(
    p_reservable_batch_id    INTEGER,
    p_renter_organization_id INTEGER,
    p_booking_person_id      INTEGER,
    p_start_date             TIMESTAMP,
    p_end_date               TIMESTAMP,
    p_booking_reference_id   INTEGER DEFAULT NULL
)
RETURNS inventory.reservable_booking
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    new_row inventory.reservable_booking;
BEGIN
    INSERT INTO inventory.reservable_booking (
        reservable_batch_id,
        renter_organization_id,
        booking_person,
        return_person,
        start_date,
        end_date,
        booking_reference
    )
    VALUES (
        p_reservable_batch_id,
        p_renter_organization_id,
        p_booking_person_id,
        NULL,
        p_start_date,
        p_end_date,
        p_booking_reference_id
    )
    RETURNING * INTO new_row;

    RETURN new_row;

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
