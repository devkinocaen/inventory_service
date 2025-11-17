// ---------- Utilitaire ----------
function minutesToPostgresInterval(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes <= 0) {
    alert('Granularité invalide : ' + minutes);
    throw new Error('Granularité invalide');
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:00`;
}

// ---------- Fonction principale ----------
export async function fetchPlanningMatrix(client, params = {}) {
  const granMinutes = Number(params.p_granularity);
  const granularity = minutesToPostgresInterval(granMinutes);

  const rpcParams = {
    p_start: params.p_start,
    p_end: params.p_end,
    p_granularity: granularity
  };

  console.log("rpcParams", rpcParams);

  const { data, error } = await client.rpc('get_planning_matrix', rpcParams);

  if (error) {
    console.error('[fetchPlanningMatrix] Erreur serveur :', error);
    return [];
  }

  // Mapping respectant exactement la structure reçue par le SQL
  return (data || []).map(batch => ({
    reservable_batch_id: batch.reservable_batch_id,
    batch_description: batch.batch_description || '',
    slots: (batch.slots || []).map(slot => ({
      start: slot.start,
      end: slot.end,
      reservables: slot.reservables || [],
      bookings: (slot.bookings || []).map(bk => ({
        id: bk.id,
        start_date: bk.start_date,
        end_date: bk.end_date,
        organization_id: bk.organization_id,
        organization_name: bk.organization_name,
        referent_first_name: bk.referent_first_name,
        referent_last_name: bk.referent_last_name,
        referent_phone: bk.referent_phone
      })),
      is_reserved: Array.isArray(slot.bookings) && slot.bookings.length > 0
    }))
  }));
}
