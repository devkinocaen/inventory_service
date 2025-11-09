-- SQL: get_subcategories
CREATE OR REPLACE FUNCTION inventory.get_subcategories()
RETURNS TABLE (
    id INT,
    category_id INT,
    category_name VARCHAR,
    name VARCHAR
)
LANGUAGE sql STABLE
AS $$
  SELECT sc.id, sc.category_id, c.name AS category_name, sc.name
  FROM inventory.reservable_subcategory sc
  JOIN inventory.reservable_category c ON c.id = sc.category_id
  ORDER BY c.name, sc.name;
$$;
