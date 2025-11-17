import { single } from '../helpers.js';

export async function updateBooking(
  client,
  {
    booking_reference_id,
    start_date,
    end_date,
    organization_id
  }
) {
  const { data, error } = await client.rpc('update_booking', {
    p_booking_reference_id: booking_reference_id,
    p_start: start_date,
    p_end: end_date,
    p_organization_id: organization_id
  });

  if (error) {
    console.error('[updateBooking] Erreur serveur :', error);
    throw error;
  }

  return data; // TRUE si OK
}
