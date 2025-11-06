-- insert_storage_locations.sql
DO $$
DECLARE
  r jsonb;
  list CONSTANT JSONB := '[
    {"name":"Magasin central","address":"12 rue du Théâtre"},
    {"name":"Dépôt Nord","address":"4 impasse des Arts"},
    {"name":"Studio Sud","address":"7 avenue du Parc"}
  ]';
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(list)
  LOOP
    INSERT INTO storage_location (name, address)
    VALUES (r->>'name', r->>'address')
    ON CONFLICT (name) DO NOTHING;
  END LOOP;

  PERFORM setval(pg_get_serial_sequence('storage_location','id'), (SELECT COALESCE(MAX(id),0) FROM storage_location), true);
END;
$$ LANGUAGE plpgsql;
