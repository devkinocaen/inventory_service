// js/api/createBooking.js
export async function createBooking(client, params = {}) {
  const rpcParams = {
    p_reservable_batch_id: params.p_reservable_batch_id ?? null,
    p_renter_organization_id: params.p_renter_organization_id ?? null,
    p_booking_reference_id: params.p_booking_reference_id ?? null,
    p_start_date: params.p_start_date ?? null,
    p_end_date: params.p_end_date ?? null
  };

  const { data, error } = await client.rpc('create_booking', rpcParams);
  if (error) {
    console.error('[createBooking] Erreur serveur :', error);
    throw error;
  }
  return data || null;
}
