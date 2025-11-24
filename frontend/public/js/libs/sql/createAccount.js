// js/api/createAccount.js

export async function createAccount(
  client,
  {
    firstName = null,
    lastName = null,
    email = null,
    phone = null,
    organization = null,
    address = null,
    role = null
  } = {}
) {
  const rpcParams = {
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_phone: phone,
    p_organization_name: organization,
    p_organization_address: address,
    p_role: role
  };

  const { data, error } = await client.rpc('create_account', rpcParams);

  if (error) {
    console.error('[createAccount] Erreur serveur :', error);
    throw error;
  }

  return data || null; // { person_id, organization_id }
}
