// js/api/fetchBookings.js
export async function fetchBookings(client, params = {}) {
  const rpcParams = {
    p_start: params.p_start ?? null,
    p_end: params.p_end ?? null,
    p_organization_id: params.p_organization_id ?? null,
    p_category_id: params.p_category_id ?? null,
    p_subcategory_id: params.p_subcategory_id ?? null
  };

  const { data, error } = await client.rpc('list_bookings', rpcParams);
  if (error) {
    console.error('[fetchBookings] Erreur serveur :', error);
    return [];
  }

  return (data || []).map(row => ({
    booking_id: row.booking_id,
    reservable_batch_id: row.reservable_batch_id,
    batch_description: row.batch_description,
    renter_organization_id: row.renter_organization_id,
    renter_name: row.renter_name,
    booking_reference_id: row.booking_reference_id,
    start_date: row.start_date,
    end_date: row.end_date,
    reservables: row.reservables || []
  }));
}
