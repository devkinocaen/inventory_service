-- insert_organizations.sql
DO $$
DECLARE
  rec jsonb;
  org_list CONSTANT JSONB := '[
    {"name":"Costumerie Centrale"},
    {"name":"Atelier Décors"},
    {"name":"Studio Lumière"},
    {"name":"Collectif Caméra"},
    {"name":"Sponsor Tech"},
    {"name":"Magasin Son"},
    {"name":"École Cinéma Local"}
  ]';
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(org_list)
  LOOP
    INSERT INTO inventory.organization (name)
    VALUES (rec->>'name')
    ON CONFLICT (name) DO NOTHING;
  END LOOP;

  PERFORM setval(pg_get_serial_sequence('inventory.organization','id'),
                 (SELECT COALESCE(MAX(id),0) FROM inventory.organization), true);
END;
$$ LANGUAGE plpgsql;
