/**
 * Récupère les organisations pour une personne donnée
 * @param {number} personId - ID de la personne
 * @returns {Promise<Array>} Liste des organisations avec rôle et référent
 */
export async function fetchOrganizationsByPersonId(client, personId) {
  if (!personId) throw new Error("personId est requis");

  try {
    // Exécute la fonction SQL
    const { data, error } = await client.rpc('get_organizations_by_person_id', {
      p_person_id: personId
    });

    if (error) {
      console.error("Erreur getOrganizationsByPersonId:", error);
      return [];
    }

      console.log ('fetchOrganizationsByPersonId', personId, data)
    // Retourne la liste ou tableau vide
    return data.map(row => ({
      id: row.organization_id,
      name: row.organization_name,
      address: row.organization_address,
      referent_id: row.referent_id,
      referent_first_name: row.referent_first_name,
      referent_last_name: row.referent_last_name
    }));

  } catch (err) {
    console.error("Exception getOrganizationsByPersonId:", err);
    return [];
  }
}
