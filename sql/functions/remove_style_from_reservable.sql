CREATE OR REPLACE FUNCTION public.remove_style_from_reservable(
    p_reservable_id INT,
    p_style_id INT
) RETURNS VOID AS $$
BEGIN
    DELETE FROM reservable_style_link
    WHERE reservable_id = p_reservable_id AND style_id = p_style_id;
END;
$$ LANGUAGE plpgsql;