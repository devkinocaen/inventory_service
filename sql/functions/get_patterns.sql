-- SQL: get_patterns
CREATE OR REPLACE FUNCTION inventory.get_patterns()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    css_class TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
      id,
      name::text,
      css_class::text
  FROM inventory.pattern
  ORDER BY id;
$$;
