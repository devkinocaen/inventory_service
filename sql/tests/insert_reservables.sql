-- insert_reservables.sql
DO $$
DECLARE
  r jsonb;
  i INT := 1;
  list CONSTANT JSONB := '[
    {"name":"Manteau époque 1920","type":"Costume","category":"Hauts","subcategory":"Manteau / Veste longue","size_label":"M","gender":"male","price":12.50,"description":"Manteau laine, doublé"},
    {"name":"Robe soirée vintage","type":"Costume","category":"Robes & Tenues","subcategory":"Robe","size_label":"S","gender":"female","price":15.00,"description":"Robe satin, perles fausses"},
    {"name":"Chapeau melon","type":"Costume","category":"Chapeaux & Coiffes","subcategory":"Chapeau","size_label":"OS","gender":"unisex","price":3.00,"description":"Chapeau noir"},
    {"name":"Cape de magicien","type":"Costume","category":"Robes & Tenues","subcategory":"Cape / Mantelet","size_label":"L","gender":"unisex","price":8.00,"description":"Cape en velours bleu"},
    {"name":"Gilet chevalier","type":"Costume","category":"Hauts","subcategory":"Gilet","size_label":"M","gender":"male","price":10.00,"description":"Gilet cuir imitation armure"},
    {"name":"Jupe médiévale","type":"Costume","category":"Bas","subcategory":"Jupe","size_label":"S","gender":"female","price":7.50,"description":"Jupe longue en coton"},
    {"name":"Chapeau haut de forme","type":"Costume","category":"Chapeaux & Coiffes","subcategory":"Chapeau","size_label":"OS","gender":"unisex","price":5.00,"description":"Chapeau noir élégant"},
    {"name":"Épée en bois","type":"Costume","category":"Accessoires","subcategory":"Autre accessoire","size_label":"OS","gender":"unisex","price":4.00,"description":"Épée de théâtre, bois léger"},
    {"name":"Bottes chevalier","type":"Costume","category":"Chaussures","subcategory":"Bottes","size_label":"42","gender":"male","price":12.00,"description":"Bottes imitation cuir"},
    {"name":"Gants aristocrate","type":"Costume","category":"Accessoires","subcategory":"Gants / Mitaines","size_label":"M","gender":"unisex","price":3.50,"description":"Gants en tissu blanc"}
  ]';
  
  v_owner INT;
  v_manager INT;
  v_status INT;
  v_size_id INT;
  v_type_id INT;
  v_cat_id INT;
  v_subcat_id INT;
  v_storage_id INT;
BEGIN
  -- fallback owner/manager : première organization
  SELECT id INTO v_owner FROM organization ORDER BY id LIMIT 1;
  v_manager := v_owner;

  -- stockage par défaut
  SELECT id INTO v_storage_id FROM storage_location ORDER BY id LIMIT 1;

  FOR r IN SELECT * FROM jsonb_array_elements(list)
  LOOP
    -- Vérifier si le reservable existe déjà par nom
    IF EXISTS (SELECT 1 FROM reservable WHERE name = r->>'name') THEN
      CONTINUE;
    END IF;

    -- status "disponible" si existe
    SELECT id INTO v_status FROM reservable_status WHERE name = 'disponible' LIMIT 1;

    -- type
    SELECT id INTO v_type_id FROM reservable_type WHERE name = r->>'type' LIMIT 1;

    -- category & subcategory
    SELECT id INTO v_cat_id FROM reservable_category WHERE name = r->>'category' LIMIT 1;
    SELECT id INTO v_subcat_id FROM reservable_subcategory WHERE name = r->>'subcategory' AND category_id = v_cat_id LIMIT 1;

    -- size si présent
    IF r->>'size_label' IS NOT NULL THEN
      SELECT id INTO v_size_id FROM size WHERE label = r->>'size_label' LIMIT 1;
    ELSE
      v_size_id := NULL;
    END IF;

    -- insertion sécurisée
    INSERT INTO reservable (
      name, type_id, owner_id, manager_id, status_id, storage_location_id,
      category_id, subcategory_id, size_id, gender, price_per_day, description, photos
    )
    VALUES (
      r->>'name',
      v_type_id,
      v_owner,
      v_manager,
      v_status,
      v_storage_id,
      v_cat_id,
      v_subcat_id,
      v_size_id,
      (r->>'gender')::reservable_gender,
      (r->>'price')::NUMERIC,
      r->>'description',
      '[]'::jsonb
    )
    ON CONFLICT (name) DO NOTHING;

    i := i + 1;
  END LOOP;

  -- ajuster la séquence
  PERFORM setval(pg_get_serial_sequence('reservable','id'), (SELECT COALESCE(MAX(id),0) FROM reservable), true);
END;
$$ LANGUAGE plpgsql;
