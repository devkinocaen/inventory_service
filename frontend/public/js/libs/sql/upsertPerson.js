import { single } from '../helpers.js';

export async function upsertPerson(client, {
  first_name,
  last_name,
  email = null,
  phone = null,
  address = null
}) {
  const { data, error } = await client.rpc('upsert_person', {
    p_first_name: first_name,
    p_last_name: last_name,
    p_email: email,
    p_phone: phone,
    p_address: address
  });

  if (error) {
    console.error('[upsertPerson] Erreur serveur :', error);
    throw new Error(error.message || 'Erreur lors de l’upsert personne');
  }

  return single (data);
}
