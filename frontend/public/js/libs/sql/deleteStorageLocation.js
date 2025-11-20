// js/api/deleteStorageLocation.js
export async function deleteStorageLocation(client, storageId) {
  if (!storageId) {
    throw new Error('L’ID du lieu de stockage est requis pour la suppression');
  }

  const { data, error } = await client.rpc('delete_storage_location', {
    p_id: storageId
  });

  if (error) {
    console.error('[deleteStorageLocation] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la suppression du lieu de stockage');
  }

  return true; // succès
}
