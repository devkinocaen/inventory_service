CREATE OR REPLACE FUNCTION inventory.delete_person(
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM inventory.person
    WHERE first_name = p_first_name
      AND last_name = p_last_name;
END;
$$;
