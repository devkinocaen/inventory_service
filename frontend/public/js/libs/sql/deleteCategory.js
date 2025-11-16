export async function deleteCategory(client, categoryId) {
  if (!categoryId) throw new Error('L’ID de la catégorie est requis pour la suppression');
  const { error } = await client.rpc('delete_category', { p_category_id: categoryId });
  if (error) {
    console.error('[deleteCategory] Erreur serveur :', error);
    throw error;
  }
  return true;
}
