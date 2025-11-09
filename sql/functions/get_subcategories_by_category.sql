-- SQL: get_subcategories_by_category
CREATE OR REPLACE FUNCTION inventory.get_subcategories_by_category(p_category_id INT)
RETURNS TABLE (
    id INT,
    name VARCHAR
)
LANGUAGE sql STABLE
AS $$
  SELECT id, name FROM inventory.reservable_subcategory
  WHERE category_id = p_category_id
  ORDER BY name;
$$;
