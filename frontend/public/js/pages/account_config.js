import { initClient } from '../libs/client.js';
import {
  fetchOrganizations,
  fetchOrganizationsByPersonId,
  upsertOrganization,
  upsertPerson,
  deletePerson
} from '../libs/sql/index.js';

import { populateSelect } from '../libs/ui/populateSelect.js';
import { formatServerError } from '../libs/helpers.js';

let client = null;
let personId = null;
let organizations = [];

const orgSelect = document.getElementById('organization');
const saveOrgBtn = document.getElementById('saveOrgBtn');
const saveRefBtn = document.getElementById('saveRefBtn');
const savePersonBtn = document.getElementById('savePersonBtn');
const peopleList = document.getElementById('peopleList');
const changePwdBtn = document.getElementById('changePwdBtn');

// Inputs
const orgName = document.getElementById('orgName');
const orgAddress = document.getElementById('orgAddress');

const refLast = document.getElementById('refLastName');
const refFirst = document.getElementById('refFirstName');
const refEmail = document.getElementById('refEmail');
const refPhone = document.getElementById('refPhone');

const pLast = document.getElementById('pLast');
const pFirst = document.getElementById('pFirst');
const pEmail = document.getElementById('pEmail');
const pPhone = document.getElementById('pPhone');
const pRole = document.getElementById('pRole');


// -----------------------------------------------------
// Initialisation
// -----------------------------------------------------
(async function init() {
  client = await initClient();

  try {
    const logged = JSON.parse(localStorage.getItem("loggedUser") || "{}");
    personId = logged.personId ?? null;
  } catch (err) {
    console.warn("Impossible de lire loggedUser");
  }

  await loadOrganizations();
  bindEvents();
})();


// -----------------------------------------------------
// Charger organisations
// Option 3 : dépend de personId
// -----------------------------------------------------
async function loadOrganizations() {
  try {
    organizations = personId
      ? await fetchOrganizationsByPersonId(client, personId)
      : await fetchOrganizations(client);

    populateSelect(orgSelect, organizations, null, {
      labelField: 'name',
      placeholder: '-- Choisir une organisation --'
    });

    if (organizations.length > 0) {
      orgSelect.value = organizations[0].id;
      loadOrganizationDetails();
    }
  } catch (err) {
    console.error("Erreur organisations :", err);
  }
}


// -----------------------------------------------------
// Charger détails orga
// -----------------------------------------------------
function loadOrganizationDetails() {
  const orgId = parseInt(orgSelect.value);
  const org = organizations.find(o => o.id === orgId);

  if (!org) return;

  orgName.value = org.name ?? '';
  orgAddress.value = org.address ?? '';

  // Référent
  refLast.value = org.referent_last_name ?? '';
  refFirst.value = org.referent_first_name ?? '';
  refEmail.value = org.referent_email ?? '';
  refPhone.value = org.referent_phone ?? '';

  // Personnes liées
  renderPeople(org.persons || []);
}


// -----------------------------------------------------
// Afficher les personnes liées
// -----------------------------------------------------
function renderPeople(list) {
  peopleList.innerHTML = '';

  list.forEach(person => {
    const row = document.createElement('div');
    row.className = 'person-row';

    const info = document.createElement('div');
    info.className = 'person-info';
    info.textContent = `${person.first_name} ${person.last_name} — ${person.email ?? ''}`;

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = '×';
    remove.addEventListener('click', () => removePerson(person.id));

    row.appendChild(info);
    row.appendChild(remove);

    peopleList.appendChild(row);
  });
}


// -----------------------------------------------------
// Suppression personne liée
// -----------------------------------------------------
async function removePerson(id) {
  if (!confirm("Supprimer cette personne ?")) return;

  try {
    await deletePerson(client, id);
    await loadOrganizations();
  } catch (err) {
    alert("Erreur : " + formatServerError(err.message));
  }
}


// -----------------------------------------------------
// Sauvegarde organisation
// -----------------------------------------------------
async function saveOrganization() {
  const orgId = parseInt(orgSelect.value);

  try {
    await upsertOrganization(client, {
      id: orgId,
      name: orgName.value.trim(),
      address: orgAddress.value.trim()
    });

    alert("Organisation enregistrée");
    await loadOrganizations();
  } catch (err) {
    alert("Erreur : " + formatServerError(err.message));
  }
}


// -----------------------------------------------------
// Sauvegarde référent
// -----------------------------------------------------
async function saveRef() {
  const orgId = parseInt(orgSelect.value);

  try {
    await upsertOrganization(client, {
      id: orgId,
      referent: {
        first_name: refFirst.value.trim(),
        last_name: refLast.value.trim(),
        email: refEmail.value.trim(),
        phone: refPhone.value.trim()
      }
    });

    alert("Référent mis à jour");
    await loadOrganizations();
  } catch (err) {
    alert("Erreur : " + formatServerError(err.message));
  }
}


// -----------------------------------------------------
// Ajouter / MAJ personne liée
// -----------------------------------------------------
async function savePerson() {
  const orgId = parseInt(orgSelect.value);

  try {
    await upsertPerson(client, {
      organization_id: orgId,
      first_name: pFirst.value.trim(),
      last_name: pLast.value.trim(),
      email: pEmail.value.trim(),
      phone: pPhone.value.trim(),
      role: pRole.value.trim()
    });

    alert("Personne enregistrée");
    pFirst.value = pLast.value = pEmail.value = pPhone.value = pRole.value = '';
    await loadOrganizations();
  } catch (err) {
    alert("Erreur : " + formatServerError(err.message));
  }
}


// -----------------------------------------------------
// Changement mot de passe (placeholder)
// -----------------------------------------------------
async function changePassword() {
  const current = document.getElementById('pwdCurrent').value;
  const pwd1 = document.getElementById('pwdNew').value;
  const pwd2 = document.getElementById('pwdConfirm').value;

  if (pwd1 !== pwd2) return alert("Les mots de passe ne correspondent pas");

  alert("(TODO) Modifier mot de passe via ton endpoint interne");
}


// -----------------------------------------------------
function bindEvents() {
  orgSelect.addEventListener('change', loadOrganizationDetails);
  saveOrgBtn.addEventListener('click', saveOrganization);
  saveRefBtn.addEventListener('click', saveRef);
  savePersonBtn.addEventListener('click', savePerson);
  changePwdBtn.addEventListener('click', changePassword);
}
