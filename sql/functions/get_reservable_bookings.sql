CREATE OR REPLACE FUNCTION public.get_reservable_bookings(
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL
) RETURNS TABLE(
    booking_id INT,
    reservable_id INT,
    renter_organization_id INT,
    booking_reference_id INT,
    start_date TIMESTAMP,
    end_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, reservable_id, renter_organization_id, booking_reference_id, start_date, end_date
    FROM reservable_booking
    WHERE (p_start_date IS NULL OR p_end_date IS NULL)
       OR (start_date <= p_end_date AND end_date >= p_start_date);
END;
$$ LANGUAGE plpgsql STABLE;