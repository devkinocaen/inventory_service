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
    isIndividual = false,
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
    p_is_individual: isIndividual,
    p_role: role
  };

  const { data, error } = await client.rpc('create_account', rpcParams);

  if (error) {
    console.error('[createAccount] Erreur serveur :', error);
    throw error;
  }

  // data = array of rows returned by Postgres (plpgsql RETURN QUERY)
  return data?.[0] || null; // { person_id, organization_id, created_user_id }
}
