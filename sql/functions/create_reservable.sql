CREATE OR REPLACE FUNCTION public.create_reservable(
    name TEXT,
    type_id INT,
    owner_id INT,
    manager_id INT DEFAULT NULL,
    status_id INT DEFAULT NULL,
    storage_location_id INT DEFAULT NULL,
    category_id INT DEFAULT NULL,
    subcategory_id INT DEFAULT NULL,
    gender reservable_gender DEFAULT 'unisex',
    privacy privacy_type DEFAULT 'private',
    price_per_day NUMERIC DEFAULT 0,
    description TEXT DEFAULT NULL,
    photos JSONB DEFAULT '[]'::jsonb
) RETURNS INT AS $$
DECLARE
    new_id INT;
BEGIN
    INSERT INTO reservable(name,type_id,owner_id,manager_id,status_id,storage_location_id,category_id,subcategory_id,gender,privacy,price_per_day,description,photos)
    VALUES(name,type_id,owner_id,manager_id,status_id,storage_location_id,category_id,subcategory_id,gender,privacy,price_per_day,description,photos)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;