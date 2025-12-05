CREATE OR REPLACE FUNCTION inventory.get_colors()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'hex_code', c.hex_code
    )
    ORDER BY c.name
  )
  FROM inventory.color c;
$$;
