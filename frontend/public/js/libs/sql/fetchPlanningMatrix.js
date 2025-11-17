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

  console.log('data', data);

  // Mapping respectant la nouvelle structure : slots ne contiennent plus de bookings
  return (data || []).map(batch => ({
    reservable_batch_id: batch.reservable_batch_id,
    batch_description: batch.batch_description || '',
    organization_id: batch.organization_id,
    organization_name: batch.organization_name,
    referent_first_name: batch.referent_first_name,
    referent_last_name: batch.referent_last_name,
    referent_mobile: batch.referent_mobile,
    reservables: batch.reservables || [],
    slots: (batch.slots || []).map(slot => ({
      start: new Date(slot.start),
      end: new Date(slot.end)
    }))
  }));
}
