-- SQL: get_reservable_types
CREATE OR REPLACE FUNCTION inventory.get_reservable_types()
RETURNS TABLE (inventory_type TEXT)
LANGUAGE sql STABLE
AS $$
    SELECT unnest(enum_range(NULL::inventory.reservable_type))::TEXT;
$$;
