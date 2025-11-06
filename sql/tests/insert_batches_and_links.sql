-- insert_batches_and_links_costumes.sql
DO $$
DECLARE
  b jsonb;
  batch_list CONSTANT JSONB := '[
    {"name":"Lot Robes & Tenues","description":"Costumes de scène féminins et masculins"},
    {"name":"Lot Chapeaux & Coiffes","description":"Chapeaux, perruques, casques"},
    {"name":"Lot Accessoires","description":"Bijoux, ceintures, gants, lunettes"}
  ]';
  r INT;
  chosen_ids INT[];
  nb INT;
  v_owner INT;
  v_manager INT;
  v_status INT;
  v_batch_id INT;
BEGIN
  -- fallback owner/manager/status
  SELECT id INTO v_owner FROM organization ORDER BY id LIMIT 1;
  v_manager := v_owner;
  SELECT id INTO v_status FROM reservable_status ORDER BY id LIMIT 1;

  FOR b IN SELECT * FROM jsonb_array_elements(batch_list) LOOP
    -- insertion sécurisée : si le nom existe déjà, on récupère son id
    INSERT INTO reservable_batch (name, description, owner_id, manager_id, status_id)
    VALUES (b->>'name', b->>'description', v_owner, v_manager, v_status)
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO v_batch_id;

    -- si déjà existant, récupérer id existant
    IF v_batch_id IS NULL THEN
      SELECT id INTO v_batch_id FROM reservable_batch WHERE name = b->>'name';
    END IF;

    -- lier 1..4 réservables aléatoires correspondant aux costumes/accessoires
    SELECT array_agg(id) INTO chosen_ids
    FROM (
      SELECT id FROM reservable
      WHERE type_id = (SELECT id FROM reservable_type WHERE name='Costume')
         OR type_id = (SELECT id FROM reservable_type WHERE name='Accessoire')
      ORDER BY random()
      LIMIT (1 + floor(random()*4))::int
    ) s;

    IF chosen_ids IS NOT NULL THEN
      FOREACH r IN ARRAY chosen_ids LOOP
        INSERT INTO reservable_batch_link (batch_id, reservable_id)
        VALUES (v_batch_id, r)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  -- ajuster la séquence
  PERFORM setval(pg_get_serial_sequence('reservable_batch','id'), (SELECT COALESCE(MAX(id),0) FROM reservable_batch), true);
END;
$$ LANGUAGE plpgsql;
