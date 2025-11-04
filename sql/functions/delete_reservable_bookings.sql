CREATE OR REPLACE FUNCTION public.delete_reservable_bookings(
    p_booking_ids INT[]
) RETURNS VOID AS $$
BEGIN
    DELETE FROM reservable_booking
    WHERE id = ANY(p_booking_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;