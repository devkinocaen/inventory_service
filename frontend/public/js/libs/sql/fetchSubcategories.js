// js/api/fetchSubcategories.js
export async function fetchSubcategories(client) {
  const { data, error } = await client.rpc('get_subcategories', {});
  if (error) {
    console.error('[fetchSubcategories] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
