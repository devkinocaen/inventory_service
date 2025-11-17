import { single } from '../helpers.js';

export async function deleteBooking(client, { booking_reference_id }) {
  const { data, error } = await client.rpc('delete_booking', {
    p_booking_reference_id: booking_reference_id
  });

  if (error) {
    console.error('[deleteBooking] Erreur serveur :', error);
    throw error;
  }

  return data;
}
