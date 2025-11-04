CREATE OR REPLACE FUNCTION public.update_reservable_booking(
    p_id INT,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL,
    p_renter_organization_id INT DEFAULT NULL,
    p_booking_reference_id INT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE reservable_booking
    SET start_date = COALESCE(p_start_date, start_date),
        end_date = COALESCE(p_end_date, end_date),
        renter_organization_id = COALESCE(p_renter_organization_id, renter_organization_id),
        booking_reference_id = COALESCE(p_booking_reference_id, booking_reference_id)
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;