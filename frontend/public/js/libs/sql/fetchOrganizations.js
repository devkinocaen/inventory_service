export async function fetchOrganizations(client, isCostumeRenter = false) {
 
  const { data, error } = await client.rpc('get_organizations', {
       p_is_costume_renter: isCostumeRenter});
    
  if (error) {
    console.error('[fetchOrganizations] Erreur serveur :', error);
    return [];
  }

  return (data || []).map(org => ({
    ...org,
    persons: org.persons || []  // JSONB déjà renvoyé par le serveur
  }));
}
