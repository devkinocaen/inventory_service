import { single } from '../helpers.js';

/**
 * Récupère un reservable par son ID
 * @param {Object} client - client RPC Postgres
 * @param {number} id - ID du reservable
 * @returns {Promise<Object|null>} - Objet reservable ou null si non trouvé
 */
export async function fetchReservableById(client, id) {
  if (!id) throw new Error('L’ID du reservable est obligatoire');

  const { data, error } = await client.rpc('get_reservable_by_id', {
    p_id: id
  });

  if (error) {
    console.error('[fetchReservableById] Erreur serveur :', error);
    throw error;
  }

  return single(data);
}
