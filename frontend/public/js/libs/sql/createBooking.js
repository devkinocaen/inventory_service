// js/api/createBooking.js
export async function createBooking(client, params = {}) {

  const rpcParams = {
    p_reservable_batch_id:    params.p_reservable_batch_id ?? null,
    p_renter_organization_id: params.p_renter_organization_id ?? null,
    p_booking_person_id:      params.p_booking_person_id ?? null, // personne qui crée la réservation
    p_pickup_person_id:       params.p_pickup_person_id ?? null,  // personne qui récupère le panier
    p_start_date:             params.p_start_date ?? null,
    p_end_date:               params.p_end_date ?? null,
    p_booking_reference_id:   params.p_booking_reference_id ?? null, // toujours en dernier
    p_status:                 params.p_status ?? 'à valider' // 'validé', 'à valider', ou 'annulé'
  };

  const { data, error } = await client.rpc('create_booking', rpcParams);

  if (error) {
    console.error('[createBooking] Erreur serveur :', error);
    throw error;
  }

  // RETURN QUERY renvoie un tableau, donc on retourne le premier élément
  return data?.[0] || null;
}
