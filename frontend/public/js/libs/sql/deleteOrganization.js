// js/api/deleteOrganization.js
export async function deleteOrganization(client, orgId) {
  if (!orgId) throw new Error('L’ID de l’organisation est requis pour la suppression');

  const { data, error } = await client.rpc('delete_organization', {
    p_org_id: orgId
  });

  if (error) {
    console.error('[deleteOrganization] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la suppression de l’organisation');
  }

  return true; // succès
}
