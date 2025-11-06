-- insert_persons.sql
DO $$
DECLARE
  p jsonb;
  i INT := 1;
  list CONSTANT JSONB := '[
    {"first_name":"Alice","last_name":"Durand","email":"alice.durand@example.com","phone":"0612345678"},
    {"first_name":"Marc","last_name":"Leroy","email":"marc.leroy@example.com","phone":"0623456789"},
    {"first_name":"Sophie","last_name":"Moreau","email":"sophie.moreau@example.com","phone":"0634567890"},
    {"first_name":"Romain","last_name":"Petit","email":"romain.petit@example.com","phone":"0645678901"},
    {"first_name":"Claire","last_name":"Martin","email":"claire.martin@example.com","phone":"0656789012"}
  ]';
BEGIN
  FOR p IN SELECT * FROM jsonb_array_elements(list)
  LOOP
    INSERT INTO inventory.person (id, first_name, last_name, email, phone)
    VALUES (i, p->>'first_name', p->>'last_name', p->>'email', p->>'phone')
    ON CONFLICT (first_name, last_name) DO NOTHING;
    i := i + 1;
  END LOOP;

  PERFORM setval(pg_get_serial_sequence('inventory.person','id'),
                 (SELECT COALESCE(MAX(id),0) FROM inventory.person), true);
END;
$$ LANGUAGE plpgsql;
