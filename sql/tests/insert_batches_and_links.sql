DO $$
DECLARE
  b jsonb;
  batch_list CONSTANT JSONB := '[
    {"description":"Lot Robes & Tenues"},
    {"description":"Lot Chapeaux & Coiffes"},
    {"description":"Lot Accessoires"},
    {"description":"Lot Vestes & Manteaux"},
    {"description":"Lot Pantalons & Jupes"},
    {"description":"Lot Chaussures"},
    {"description":"Lot Bijoux & Montres"}
  ]';
  r INT;
  chosen_ids INT[];
  v_owner INT;
  v_manager INT;
  v_status inventory.reservable_status;
  v_batch_id INT;
BEGIN
  -- fallback owner/manager/status
  SELECT id INTO v_owner FROM inventory.organization ORDER BY id LIMIT 1;
  v_manager := v_owner;
  v_status := 'disponible'::inventory.reservable_status;

  FOR b IN SELECT * FROM jsonb_array_elements(batch_list) LOOP
    -- insertion sécurisée : si le lot existe déjà, récupérer son id
    INSERT INTO inventory.reservable_batch (description)
    VALUES (b->>'description')
    RETURNING id INTO v_batch_id;

    IF v_batch_id IS NULL THEN
      SELECT id INTO v_batch_id FROM inventory.reservable_batch WHERE description = b->>'description';
    END IF;

    -- lier 1..4 réservables aléatoires correspondant aux costumes/accessoires
    SELECT array_agg(id) INTO chosen_ids
    FROM (
      SELECT id
      FROM inventory.reservable
      WHERE inventory_type IN ('costume'::inventory.reservable_type, 'equipment'::inventory.reservable_type)
      ORDER BY random()
      LIMIT (1 + floor(random()*4))::int
    ) s;

    IF chosen_ids IS NOT NULL THEN
      FOREACH r IN ARRAY chosen_ids LOOP
        -- lier le reservable au batch
        INSERT INTO inventory.reservable_batch_link (batch_id, reservable_id)
        VALUES (v_batch_id, r)
        ON CONFLICT DO NOTHING;

        -- forcer status et is_in_stock
        UPDATE inventory.reservable
        SET status = v_status,
            is_in_stock = TRUE
        WHERE id = r;
      END LOOP;
    END IF;
  END LOOP;

  -- ajuster la séquence
  PERFORM setval(pg_get_serial_sequence('inventory.reservable_batch','id'),
                 (SELECT COALESCE(MAX(id),0) FROM inventory.reservable_batch), true);
END;
$$ LANGUAGE plpgsql;
