import { single } from '../helpers.js';

export async function deleteBooking(client, booking_id) {
  const { data, error } = await client.rpc('delete_booking', {
    p_booking_id: booking_id
  });

  if (error) {
    console.error('[deleteBooking] Erreur serveur :', error);
    throw error;
  }

  return data;
}
