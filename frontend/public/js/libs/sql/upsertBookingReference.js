import { single } from '../helpers.js';

/**
 * Upsert d'une booking reference
 * @param {object} ref - { name: string, description?: string }
 * @returns {Promise<object>} - Objet booking_reference { id, name, description }
 */
export async function upsertBookingReference(client, ref) {
  try {
    if (!ref || !ref.name) {
      throw new Error('Le nom de la référence est obligatoire');
    }

    // Appel RPC
    const res = await client.rpc('upsert_booking_reference', {
      p_name: ref.name,
      p_description: ref.description || ''
    });

    // Vérifie si le RPC a renvoyé une erreur
    if (res.error) {
      throw new Error(res.error.message || 'Erreur RPC inconnue');
    }

    // Prend le premier et unique élément dans data
    const bookingReference = single(res.data);

    if (!bookingReference || !bookingReference.id) {
      throw new Error('Référence de booking non créée');
    }

    return bookingReference; // { id, name, description }
  } catch (err) {
    console.error('[Booking Reference] Erreur RPC:', err);
    throw new Error(`Impossible de créer la référence : ${err.message || err}`);
  }
}
