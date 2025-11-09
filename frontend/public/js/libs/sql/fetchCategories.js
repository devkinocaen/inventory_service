// js/api/fetchCategories.js
export async function fetchCategories(client) {
  const { data, error } = await client.rpc('get_categories', {});
  if (error) {
    console.error('[fetchCategories] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
