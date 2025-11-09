-- SQL: get_genders
CREATE OR REPLACE FUNCTION inventory.get_genders()
RETURNS TABLE (gender TEXT)
LANGUAGE sql STABLE
AS $$
    SELECT unnest(enum_range(NULL::inventory.reservable_gender))::TEXT;
$$;
