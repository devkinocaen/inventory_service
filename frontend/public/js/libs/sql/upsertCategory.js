import { single } from '../helpers.js';

export async function upsertCategory(client,  { name, description = null }) {
  if (!name) throw new Error('Le nom de la catégorie est obligatoire');
  const { data, error } = await client.rpc('upsert_category', {
    p_name: name,
    p_description: description // ← obligatoire même si null
  });
  if (error) {
    console.error('[upsertCategory] Erreur serveur :', error);
    throw error;
  }
  return single (data);
}
