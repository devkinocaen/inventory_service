import { single } from '../helpers.js';

export async function updateBooking(
  client,
  {
    id,
    start_date = null,
    end_date = null,
    organization_id = null
  }
) {
  if (!id) throw new Error('[updateBooking] Booking ID manquant');

  // Génération de la commande SQL prête à copier
  const sqlLog = `
SELECT * FROM inventory.update_booking(
    p_booking_id := ${id},
    p_start := ${start_date !== null ? `'${start_date}'` : 'NULL'},
    p_end := ${end_date !== null ? `'${end_date}'` : 'NULL'},
    p_organization_id := ${organization_id !== null ? organization_id : 'NULL'}
);
  `.trim();

  console.log('[updateBooking] SQL prêt à copier :\n', sqlLog);

  // Tous les paramètres sont envoyés, même si null
  const params = {
    p_booking_id: id,
    p_start: start_date,
    p_end: end_date,
    p_organization_id: organization_id
  };

  const { data, error } = await client.rpc('update_booking', params);

  if (error) {
    console.error('[updateBooking] Erreur serveur :', error);
    throw error;
  }

  return data; // TRUE si OK
}
