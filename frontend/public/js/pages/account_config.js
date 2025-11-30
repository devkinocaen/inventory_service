import { initClient } from '../libs/client.js';
import {
  fetchOrganizations,
  fetchOrganizationsByPersonId,
  upsertOrganization,
  fetchPersonById,
  upsertPerson,
  deletePerson
} from '../libs/sql/index.js';

import { populateSelect } from '../libs/ui/populateSelect.js';
import { formatServerError } from '../libs/helpers.js';

let client = null;
let personId = null;
let organizations = [];

// -----------------------------
// DOM elements
// -----------------------------
const orgSelect = document.getElementById('organizationSelect'); // FIX
const saveOrgBtn = document.getElementById('saveOrgBtn');
const saveRefBtn = document.getElementById('saveRefBtn');
const savePersonBtn = document.getElementById('savePersonBtn');
const peopleList = document.getElementById('peopleList');
const changePwdBtn = document.getElementById('changePwdBtn');

// Organisation
const orgName = document.getElementById('orgName');
const orgAddress = document.getElementById('orgAddress');

// Référent
const refLast = document.getElementById('refLastName');
const refFirst = document.getElementById('refFirstName');
const refEmail = document.getElementById('refEmail');
const refPhone = document.getElementById('refPhone');

// Personne liée
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
      
      console.log('personId', personId)
      console.log('organizations', organizations)

    // Auto-sélection première organisation
    if (organizations.length > 0) {
      orgSelect.value = organizations[0].id;
        console.log ('orgSelect', orgSelect.value)
      await loadOrganizationDetails();
    }

  } catch (err) {
    console.error("Erreur lors du chargement des organisations :", err);
  }
}

function updateReferentFields(personId, org) {
  const person = (org.persons || []).find(p => p.id == personId);
  if (!person) return;

  refFirst.value = person.first_name ?? '';
  refLast.value  = person.last_name ?? '';
  refEmail.value = person.email ?? '';
  refPhone.value = person.phone ?? '';
}


function populateReferentSelect(org) {
  const refSelect = document.getElementById('refSelect');
  refSelect.innerHTML = '';

  // Map pour éviter doublons
  const personsMap = new Map();

  // Ajouter le référent actuel en premier
  if (org.referent_id) {
    const ref = org.persons?.find(p => p.id === org.referent_id);
    if (ref) personsMap.set(ref.id, ref);
  }

  // Ajouter toutes les personnes liées (sans doublons)
  (org.persons || []).forEach(p => personsMap.set(p.id, p));

  // Création des options
  personsMap.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.first_name} ${p.last_name}${p.id === org.referent_id ? ' (référent)' : ''}`;
    if (p.id === org.referent_id) opt.selected = true;
    refSelect.appendChild(opt);
  });

  // Initialiser champs lecture seule
  updateReferentFields(refSelect.value, org);

  // Au changement du select, mettre à jour les champs
  refSelect.onchange = () => updateReferentFields(refSelect.value, org);
}


// -----------------------------------------------------
// Charger détails organisation
// -----------------------------------------------------
async function loadOrganizationDetails() {
  const orgId = parseInt(orgSelect.value);
  const org = organizations.find(o => o.id === orgId);

  if (!org) return;

  orgName.value = org.name ?? '';
  orgAddress.value = org.address ?? '';

  // Liste des personnes liées
  renderPeople(org.persons || []);

  // Référent avec select et champs lecture seule
  populateReferentSelect(org);
}



// -----------------------------------------------------
// Afficher les personnes liées
// -----------------------------------------------------
function renderPeople(list) {
  peopleList.innerHTML = '';

  list.forEach(person => {
    const row = document.createElement('div');
    row.className = 'person-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.marginBottom = '6px';

    const info = document.createElement('div');
    info.className = 'person-info';
    info.style.flex = '1';
    info.textContent = `${person.first_name} ${person.last_name} — ${person.email ?? ''} — ${person.phone ?? ''}`;

    // Clic sur la ligne : remplir les champs édition personne
    info.addEventListener('click', () => {
      pFirst.value = person.first_name ?? '';
      pLast.value = person.last_name ?? '';
      pEmail.value = person.email ?? '';
      pPhone.value = person.phone ?? '';
      pRole.value = person.role ?? '';

      // Facultatif : mettre à jour le select référent
      const refSelect = document.getElementById('refSelect');
      if (refSelect) refSelect.value = person.id;
      const orgId = parseInt(orgSelect.value);
      const org = organizations.find(o => o.id === orgId);
      if (org) updateReferentFields(person.id, org);
    });

    const remove = document.createElement('button');
    remove.className = 'person-remove-btn';
    remove.textContent = '×';
    remove.addEventListener('click', e => {
      e.stopPropagation();
      removePerson(person.id);
    });

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
  const org = organizations.find(o => o.id === orgId);

  const referent = (org.persons || []).find(p => p.id === org.referent_id);

  if (!referent || !referent.phone) {
    return alert("Le référent doit avoir un téléphone.");
  }

  try {
    await upsertOrganization(client, {
      name: orgName.value.trim(),
      address: orgAddress.value.trim(),
      referent_id: org.referent_id,
      persons: (org.persons || []).map(p => ({
        id: p.id,
        role: p.role || null
      }))
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
  const org = organizations.find(o => o.id === orgId);
  const newReferentId = parseInt(document.getElementById('refSelect').value);

  if (!newReferentId) return alert("Référent invalide");

  try {
    await upsertOrganization(client, {
      name: orgName.value.trim(),
      address: orgAddress.value.trim(),
      referent_id: newReferentId,
      persons: (org.persons || []).map(p => ({
        id: p.id,
        role: p.role || null
      }))
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
    // 1. Upsert de la personne seule
    const person = await upsertPerson(client, {
      first_name: pFirst.value.trim(),
      last_name: pLast.value.trim(),
      email: pEmail.value.trim(),
      phone: pPhone.value.trim()
    });

    // 2. On doit ajouter/mettre à jour cette personne dans l'organisation
    const org = organizations.find(o => o.id === orgId);

    // Base actuelle
    let persons = (org.persons || []).map(p => ({
      id: p.id,
      role: p.role || null
    }));

    // 3. Mise à jour ou ajout du rôle dans la liste persons[]
    const role = pRole.value.trim() || null;
    const existing = persons.find(p => p.id === person.id);

    if (existing) {
      existing.role = role;
    } else {
      persons.push({ id: person.id, role });
    }

    // 4. Upsert organisation mise à jour
    await upsertOrganization(client, {
      name: orgName.value.trim(),
      address: orgAddress.value.trim(),
      referent_id: org.referent_id, // conserver le même référent
      persons
    });

    alert("Personne enregistrée");

    pFirst.value = '';
    pLast.value = '';
    pEmail.value = '';
    pPhone.value = '';
    pRole.value = '';

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
  orgSelect.addEventListener('change', () => loadOrganizationDetails());
  saveOrgBtn.addEventListener('click', saveOrganization);
  saveRefBtn.addEventListener('click', saveRef);
  savePersonBtn.addEventListener('click', savePerson);
  changePwdBtn.addEventListener('click', changePassword);
}
