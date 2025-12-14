// js/api/cancelBooking.js
export async function cancelBooking(client, bookingId) {
  if (!bookingId) {
    throw new Error('[cancelBooking] bookingId manquant');
  }

  const rpcParams = {
    p_booking_id: bookingId
  };

  const { data, error } = await client.rpc('cancel_booking', rpcParams);

  if (error) {
    console.error('[cancelBooking] Erreur serveur :', error);
    throw error;
  }

  return data || null;
}
