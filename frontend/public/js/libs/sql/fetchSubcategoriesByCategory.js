// js/api/fetchSubcategoriesByCategory.js
export async function fetchSubcategoriesByCategory(client, categoryId) {
  const params = { p_category_id: categoryId ?? null };
  const { data, error } = await client.rpc('get_subcategories_by_category', params);
  if (error) {
    console.error('[fetchSubcategoriesByCategory] Erreur serveur :', error);
    return [];
  }
  return data || [];
}
