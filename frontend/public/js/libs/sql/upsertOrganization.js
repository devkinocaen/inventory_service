// js/api/upsertOrganization.js
import { single } from '../helpers.js';

export async function upsertOrganization(client, {
  name,
  address = null,
  referent_id = null
}) {
  const { data, error } = await client.rpc('upsert_organization', {
    p_name: name,
    p_address: address,
    p_referent_id: referent_id
  });

  if (error) {
    console.error('[upsertOrganization] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la mise à jour de l’organisation');
  }

  // Utilisation de single() pour récupérer l’enregistrement unique
  return single(data);
}
