export async function deletePerson(client, { first_name, last_name }) {
  if (!first_name || !last_name) {
    throw new Error('first_name et last_name sont obligatoires pour supprimer une personne');
  }

  const { data, error } = await client.rpc('delete_person', {
    p_first_name: first_name,
    p_last_name: last_name
  });

  if (error) {
    console.error('[deletePerson] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la suppression de la personne');
  }

  return true; // succès
}
