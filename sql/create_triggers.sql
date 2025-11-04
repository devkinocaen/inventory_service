DO $$
DECLARE
  tbl TEXT;
  tables_to_watch TEXT[] := ARRAY[
    'reservable_booking',
    'reservable_style_link',
    'reservable',
    'booking_reference',
    'reservable_style',
    'size',
    'size_type',
    'reservable_subcategory',
    'reservable_category',
    'reservable_status',
    'reservable_type',
    'organization',
    'person',
    'storage_location',
    'app_config'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_watch LOOP
    EXECUTE format(
      'CREATE TRIGGER trigger_%I_update
       AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH STATEMENT
       EXECUTE FUNCTION update_app_config_timestamp();',
      tbl, tbl
    );
  END LOOP;
END;
$$;
