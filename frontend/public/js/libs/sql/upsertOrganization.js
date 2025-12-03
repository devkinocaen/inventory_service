import { single } from '../helpers.js';

/**
 * Upsert d'une organisation avec ses liens personnes + rôles
 * @param {Object} client - instance RPC
 * @param {Object} params - { name, address, referent_id, persons }
 *    persons: [{ id: 7, role: 'manager' }, ...]
 */
export async function upsertOrganization(client, {
  name,
  address = null,
  referent_id,
  persons = [] // tableau d'objets {id, role}
}) {
  if (!referent_id) {
    throw new Error('Le référent est obligatoire');
  }

  // Transforme le tableau pour la fonction PostgreSQL
  const person_roles = persons.map(p => ({
    person_id: p.id,
    role: p.role || null
  }));

  const { data, error } = await client.rpc('upsert_organization', {
    p_name: name,
    p_address: address,
    p_referent_id: referent_id,
    p_person_roles: person_roles
  });

  if (error) {
    console.error('[upsertOrganization] Erreur serveur :', error);
    throw new Error(
      typeof error === 'string' ? error : error.message || 'Erreur lors de la mise à jour de l’organisation'
    );
  }

  // Remappe les champs avec les noms front
  const org = single(data);
  return {
    id: org.org_id,
    name: org.org_name,
    address: org.org_address,
    referent_id: org.org_referent_id
  };
}
