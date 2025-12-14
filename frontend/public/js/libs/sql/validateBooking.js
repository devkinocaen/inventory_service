// js/api/validateBooking.js
export async function validateBooking(client, bookingId) {
  if (!bookingId) {
    throw new Error('[validateBooking] bookingId manquant');
  }

  const rpcParams = {
    p_booking_id: bookingId
  };

  const { data, error } = await client.rpc('validate_booking', rpcParams);

  if (error) {
    console.error('[validateBooking] Erreur serveur :', error);
    throw error;
  }

  return data || null;
}
