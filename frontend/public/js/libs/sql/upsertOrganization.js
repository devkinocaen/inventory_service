// js/api/upsertOrganization.js
import { single } from '../helpers.js';

export async function upsertOrganization(client, {
  name,
  address = null,
  referent_id,
  person_ids = [] // tableau d'IDs des personnes liées
}) {
  if (!referent_id) {
    throw new Error('Le référent est obligatoire');
  }

  const { data, error } = await client.rpc('upsert_organization', {
    p_name: name,
    p_address: address,
    p_referent_id: referent_id,
    p_person_ids: person_ids
  });
    
  if (error) {
    console.error('[upsertOrganization] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la mise à jour de l’organisation');
  }

  // Retourne l’enregistrement unique
  return single(data);
}
