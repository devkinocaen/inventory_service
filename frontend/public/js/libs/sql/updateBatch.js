import { single } from '../helpers.js';

/**
 * Met à jour un lot (batch) avec :
 * - id : identifiant du batch à mettre à jour (required)
 * - description : texte décrivant le batch (optionnel)
 * - reservables : tableau d'objets { id } représentant les réservables à lier au batch (optionnel)
 *
 * Exemple d'appel :
 *   await updateBatch(client, {
 *       id: 4,
 *       description: 'Lot Vestes & Manteaux',
 *       reservables: [{ id: 1 }, { id: 2 }]
 *   });
 */
export async function updateBatch(client, { id, description = null, reservables = null }) {
  if (!id) {
    console.warn('[updateBatch] Batch ID manquant');
    return null;
  }

  // Extraire les IDs de réservables, filtrer null/undefined, supprimer les doublons
  const reservableIds = reservables
    ? Array.from(
        new Set(
          reservables
            .map(r => r?.id)
            .filter(rid => rid != null)
        )
      )
    : null;

  console.log('[updateBatch] Params envoyés à RPC :', {
    p_batch_id: id,
    p_description: description,
    p_reservable_ids: reservableIds,
  });

  const { data, error } = await client.rpc('update_batch', {
    p_batch_id: id,
    p_description: description,
    p_reservable_ids: reservableIds && reservableIds.length ? reservableIds : null,
  });

  if (error) {
    console.error('[updateBatch] Erreur serveur :', error);
    throw error;
  }

  console.log('[updateBatch] Batch mis à jour', data);
  return single(data);
}
