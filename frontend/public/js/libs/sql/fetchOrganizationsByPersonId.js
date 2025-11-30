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
      console.log ('data', data)
    return data.map(row => ({
      id: row.id,
      name: row.name,
      address: row.address,
      referent_id: row.referent_id,
      referent_first_name: row.referent_first_name,
      referent_last_name: row.referent_last_name,
      persons: row.persons
    }));

  } catch (err) {
    console.error("Exception getOrganizationsByPersonId:", err);
    return [];
  }
}
