// js/api/fetchOrganizationReferents.js
export async function fetchOrganizationReferents(client, orgId) {
  const { data, error } = await client.rpc('get_organization_referents', { org_id: orgId });
  if (error) {
    console.error('[fetchOrganizationReferents] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
