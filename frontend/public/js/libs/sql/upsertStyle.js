import { single } from '../helpers.js';

export async function upsertStyle(client, { name, description = null }) {
  if (!name) throw new Error('Le nom du style est obligatoire');
  
  const { data, error } = await client.rpc('upsert_style', {
    p_name: name,
    p_description: description // ← obligatoire même si null
  });
  
  if (error) {
    console.error('[upsertStyle] Erreur serveur :', error);
    throw error;
  }
  return single(data);
}
