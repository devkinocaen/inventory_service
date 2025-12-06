-- SQL: get_colors
CREATE OR REPLACE FUNCTION inventory.get_colors()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    hex_code TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
      id,
      name::text,
      hex_code::text
  FROM inventory.color;
$$;
