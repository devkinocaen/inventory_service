-- SQL: get_categories
CREATE OR REPLACE FUNCTION inventory.get_categories()
RETURNS TABLE (
    id INT,
    name VARCHAR,
    description TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT id, name, description FROM inventory.reservable_category ORDER BY name;
$$;
