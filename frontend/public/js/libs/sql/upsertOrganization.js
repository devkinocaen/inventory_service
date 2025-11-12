// js/api/upsertOrganization.js
export async function upsertOrganization(client, {
  name,
  referent_first_name,
  referent_last_name,
  referent_email = null,
  referent_phone = null
}) {
  const { data, error } = await client.rpc('upsert_organization', {
    p_name: name,
    p_referent_first_name: referent_first_name,
    p_referent_last_name: referent_last_name,
    p_referent_email: referent_email,
    p_referent_phone: referent_phone
  });

  if (error) {
    console.error('[upsertOrganization] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de la mise à jour de l’organisation');
  }

  // La fonction SQL renvoie un tableau (même pour un seul résultat)
  return data?.[0] || null;
}
