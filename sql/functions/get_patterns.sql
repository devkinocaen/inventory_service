-- SQL: get_patterns
CREATE OR REPLACE FUNCTION inventory.get_patterns()
RETURNS TABLE (
    id TEXT,
    name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
      id,
      name::text
  FROM inventory.pattern
  ORDER BY id;
$$;
