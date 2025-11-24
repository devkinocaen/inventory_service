import { initClient } from './client.js';

const client = await initClient();

/**
 * Récupère les organisations pour une personne donnée
 * @param {number} personId - ID de la personne
 * @returns {Promise<Array>} Liste des organisations avec rôle et référent
 */
export async function getOrganizationsByPersonId(personId) {
  if (!personId) throw new Error("personId est requis");

  try {
    // Exécute la fonction SQL
    const { data, error } = await client.rpc('inventory.get_organizations_by_person_id', {
      p_person_id: personId
    });

    if (error) {
      console.error("Erreur getOrganizationsByPersonId:", error);
      return [];
    }

    // Retourne la liste ou tableau vide
    return data.map(row => ({
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationAddress: row.organization_address,
      referentId: row.referent_id,
      referentFirstName: row.referent_first_name,
      referentLastName: row.referent_last_name,
      personRole: row.person_role // null si la personne est le référent
    }));

  } catch (err) {
    console.error("Exception getOrganizationsByPersonId:", err);
    return [];
  }
}
