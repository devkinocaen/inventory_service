CREATE OR REPLACE FUNCTION inventory.get_person_by_name(
    p_first_name TEXT,
    p_last_name  TEXT
)
RETURNS TABLE (
    id INT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id::int,
        p.first_name::text,
        p.last_name::text,
        p.email::text,
        p.phone::text
    FROM inventory.person AS p
    WHERE unaccent(lower(p.first_name)) = unaccent(lower(p_first_name))
      AND unaccent(lower(p.last_name))  = unaccent(lower(p_last_name));
END;
$$ LANGUAGE plpgsql STABLE;
