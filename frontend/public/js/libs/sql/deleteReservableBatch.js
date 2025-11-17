export async function deleteReservableBatch(client, { id }) {
  if (!id) {
    throw new Error('L\'ID du batch est obligatoire pour la suppression');
  }

  const { data, error } = await client.rpc('delete_reservable_batch', {
    p_batch_id: id
  });

  if (error) {
    console.error('[deleteReservableBatch] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la suppression du batch');
  }

  return true; // succès
}
