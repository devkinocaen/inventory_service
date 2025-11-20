export async function generateUniqueId(client, tableName) {
  if (!tableName) {
    throw new Error('Le nom de la table est obligatoire pour générer un ID unique');
  }

  const { data, error } = await client.rpc('generate_unique_id', {
    p_table_name: tableName
  });

  if (error) {
    console.error('[generateUniqueId] Erreur serveur :', error);
    throw new Error(error.message || `Erreur lors de la génération d'un ID unique pour la table "${tableName}"`);
  }

  // data contient le nouvel ID
  return data;
}
