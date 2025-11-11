// js/api/fetchOrganizations.js
export async function fetchOrganizations(client) {
  const { data, error } = await client.rpc('get_organizations', {});
  if (error) {
    console.error('[fetchOrganizations] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
