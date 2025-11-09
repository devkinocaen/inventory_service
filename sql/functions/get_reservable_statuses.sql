-- SQL: get_reservable_statuses
CREATE OR REPLACE FUNCTION inventory.get_reservable_statuses()
RETURNS TABLE (status TEXT)
LANGUAGE sql STABLE
AS $$
    SELECT unnest(enum_range(NULL::inventory.reservable_status))::TEXT;
$$;
