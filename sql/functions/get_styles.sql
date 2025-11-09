-- SQL: get_styles
CREATE OR REPLACE FUNCTION inventory.get_styles()
RETURNS TABLE (
    id INT,
    name VARCHAR,
    description TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT id, name, description FROM inventory.reservable_style ORDER BY name;
$$;
