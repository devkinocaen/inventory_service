CREATE OR REPLACE FUNCTION public.add_style_to_reservable(
    p_reservable_id INT,
    p_style_id INT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO reservable_style_link(reservable_id, style_id)
    VALUES(p_reservable_id, p_style_id)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;