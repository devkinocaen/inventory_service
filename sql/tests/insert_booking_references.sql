-- insert_booking_references.sql
DO $$
DECLARE
  r jsonb;
  list CONSTANT JSONB := '[
    {"name":"Réf-EXT-001","description":"Réservation externe client A"},
    {"name":"Réf-EXT-002","description":"Tournage sponsor"},
    {"name":"Réf-INT-DEV","description":"Test interne"}
  ]';
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(list) LOOP
    -- insertion sécurisée, si le nom existe déjà on ne fait rien
    INSERT INTO booking_reference (name, description)
    VALUES (r->>'name', r->>'description')
    ON CONFLICT (name) DO NOTHING;
  END LOOP;

  -- ajuster la séquence automatiquement
  PERFORM setval(pg_get_serial_sequence('booking_reference','id'), (SELECT COALESCE(MAX(id),0) FROM booking_reference), true);
END;
$$ LANGUAGE plpgsql;
