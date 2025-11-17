// libs/sql/deleteReservable.js
export async function deleteReservable(client, id) {
  if (!id) {
    throw new Error('L\'ID du reservable est obligatoire pour la suppression');
  }

  const { data, error } = await client.rpc('delete_reservable', {
    p_reservable_id: id
  });

  if (error) {
    console.error('[deleteReservable] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la suppression du reservable');
  }

  return true; // succès
}
