export async function fetchOrganizations(client) {
 
  const { data, error } = await client.rpc('get_organizations', {});
  if (error) {
    console.error('[fetchOrganizations] Erreur serveur :', error);
    return [];
  }

  return (data || []).map(org => ({
    ...org,
    persons: org.persons || []  // JSONB déjà renvoyé par le serveur
  }));
}
