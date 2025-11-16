import { single } from '../helpers.js';

export async function upsertSubcategory(client, { categoryId, name }) {
  if (!name) throw new Error('Le nom de la sous-catégorie est obligatoire');
  if (!categoryId) throw new Error('La catégorie parente est obligatoire');
  const { data, error } = await client.rpc('upsert_subcategory', {
    p_category_id: categoryId,
    p_name: name
  });
  if (error) {
    console.error('[upsertSubcategory] Erreur serveur :', error);
    throw error;
  }
  return single (data);
}
