CREATE OR REPLACE FUNCTION public.create_reservable_booking(
    p_reservable_id INT,
    p_renter_organization_id INT,
    p_booking_reference_id INT,
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
) RETURNS INT AS $$
DECLARE
    new_id INT;
BEGIN
    INSERT INTO reservable_booking(reservable_id, renter_organization_id, booking_reference_id, start_date, end_date)
    VALUES(p_reservable_id, p_renter_organization_id, p_booking_reference_id, p_start_date, p_end_date)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;