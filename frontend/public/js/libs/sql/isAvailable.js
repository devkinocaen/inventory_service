// js/api/isAvailable.js

/**
 * Vérifie si un item est disponible sur une période donnée
 * @param {object} client - instance Supabase / Neon
 * @param {number} reservableId - ID du réservable
 * @param {string|Date} startDate - début période
 * @param {string|Date} endDate - fin période
 * @returns {Promise<boolean>} true si disponible, false sinon
 */
export async function isAvailable(client, reservableId, startDate, endDate) {
  if (!reservableId || !startDate || !endDate) {
    throw new Error('Tous les paramètres sont obligatoires : reservableId, startDate, endDate');
  }

  const rpcParams = {
    p_reservable_id: reservableId,
    p_start_date: startDate,
    p_end_date: endDate
  };

  const { data, error } = await client.rpc('is_available', rpcParams);

  if (error) {
    console.error('[isAvailable] Erreur serveur :', error);
    throw error;
  }

  return data ?? false;
}
