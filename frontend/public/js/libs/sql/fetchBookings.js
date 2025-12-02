import { single } from '../helpers.js';

/**
 * Récupère les réservations selon les filtres optionnels
 * @param {object} client - instance du client Neon/PostgreSQL
 * @param {object} params - filtres optionnels :
 *    { p_start, p_end, p_organization_id, p_organization_ids,
 *      p_category_id, p_category_ids, p_subcategory_id, p_subcategory_ids }
 * @returns {Promise<Array>} - tableau d'objets booking
 */
export async function fetchBookings(client, params = {}) {
  const {
    p_start = null,
    p_end = null,
    p_organization_id = null,
    p_organization_ids = null,
    p_category_id = null,
    p_category_ids = null,
    p_subcategory_id = null,
    p_subcategory_ids = null
  } = params;

  // 🔹 Contrôle d'exclusivité : soit ID simple, soit tableau, pas les deux
  if (p_organization_id !== null && p_organization_ids !== null) {
    throw new Error("Ne passez pas à la fois p_organization_id et p_organization_ids");
  }
  if (p_category_id !== null && p_category_ids !== null) {
    throw new Error("Ne passez pas à la fois p_category_id et p_category_ids");
  }
  if (p_subcategory_id !== null && p_subcategory_ids !== null) {
    throw new Error("Ne passez pas à la fois p_subcategory_id et p_subcategory_ids");
  }

  // 🔹 Normalisation : transformer les ID simples en tableau
  const orgs = p_organization_ids ?? (p_organization_id !== null ? [p_organization_id] : null);
  const cats = p_category_ids ?? (p_category_id !== null ? [p_category_id] : null);
  const subcats = p_subcategory_ids ?? (p_subcategory_id !== null ? [p_subcategory_id] : null);

  const { data, error } = await client.rpc('get_bookings', {
    p_start,
    p_end,
    p_organization_ids: orgs,
    p_category_ids: cats,
    p_subcategory_ids: subcats
  });

  if (error) {
    console.error('[fetchBookings] Erreur serveur :', error);
    return [];
  }

  // 🔹 Retour : transformer JSONB reservables en tableau JS si nécessaire
  return (data || []).map(row => ({
    booking_id: row.booking_id,
    reservable_batch_id: row.reservable_batch_id,
    batch_description: row.batch_description,
    renter_organization_id: row.renter_organization_id,
    renter_name: row.renter_name,
    booking_reference_id: row.booking_reference_id,
    booking_person_id: row.booking_person_id,
    booking_person_name: row.booking_person_name,
    start_date: row.start_date,
    end_date: row.end_date,
    booked_at: row.booked_at,
    reservables: row.reservables || []
  }));
}
