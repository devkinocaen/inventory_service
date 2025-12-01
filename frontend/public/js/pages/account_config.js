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
let currentEditPersonId = null;

// -----------------------------
// DOM elements
// -----------------------------
const orgSelect = document.getElementById('organizationSelect');
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

    if (organizations.length > 0) {
      orgSelect.value = organizations[0].id;
      await loadOrganizationDetails();
    }

  } catch (err) {
    console.error("Erreur lors du chargement des organisations :", err);
  }
}

// -----------------------------------------------------
function updateReferentFields(personId, org) {
  const person = (org.persons || []).find(p => p.id == personId);
  if (!person) return;

  refFirst.value = person.first_name ?? '';
  refLast.value  = person.last_name ?? '';
  refEmail.value = person.email ?? '';
  refPhone.value = person.phone ?? '';
}

// -----------------------------------------------------
function populateReferentSelect(org, ref) {
  const refSelect = document.getElementById('refSelect');
  refSelect.innerHTML = '';

  const personsMap = new Map();
  if (ref) personsMap.set(ref.id, ref);

  (org.persons || []).forEach(p => personsMap.set(p.id, p));

  personsMap.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.first_name} ${p.last_name}${p.id === org.referent_id ? ' (référent)' : ''}`;
    if (p.id === org.referent_id) opt.selected = true;
    refSelect.appendChild(opt);
  });

  updateReferentFields(refSelect.value, org);

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
console.log ("*** org", org)
  const ref = await fetchPersonById(client, org.referent_id)
    console.log ("*** ref", ref)

  renderPeople(org.persons || []);
  populateReferentSelect(org, ref);
}

// -----------------------------------------------------
// Afficher les personnes liées
// -----------------------------------------------------
function renderPeople(list) {
  peopleList.innerHTML = '';
console.log ("list", list)
  list.forEach(person => {
    const row = document.createElement('div');
    row.className = 'person-row-card';
    row.style.padding = '10px';
    row.style.marginBottom = '10px';
    row.style.border = '1px solid #ccc';
    row.style.borderRadius = '8px';
    row.style.background = '#fafafa';

    row.innerHTML = `
      <div class="form-grid">
        <div><label>Nom</label><input class="pl-last" value="${person.last_name ?? ''}"></div>
        <div><label>Prénom</label><input class="pl-first" value="${person.first_name ?? ''}"></div>
        <div><label>Email</label><input class="pl-email" value="${person.email ?? ''}"></div>
        <div><label>Téléphone</label><input class="pl-phone" value="${person.phone ?? ''}"></div>
        <div><label>Rôle</label><input class="pl-role" value="${person.role ?? ''}"></div>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button class="btn btn-save btn-small pl-update">Mettre à jour</button>
        <button class="btn btn-danger btn-small pl-remove">Supprimer</button>
      </div>
    `;

    row.querySelector('.pl-update').onclick = async () => {
      const updated = {
        id: person.id,
        first_name: row.querySelector('.pl-first').value.trim(),
        last_name: row.querySelector('.pl-last').value.trim(),
        email: row.querySelector('.pl-email').value.trim(),
        phone: row.querySelector('.pl-phone').value.trim(),
        role: row.querySelector('.pl-role').value.trim() || null
      };

      await saveExistingPerson(updated);
    };

    row.querySelector('.pl-remove').onclick = () => detachPerson(person.id);

    peopleList.appendChild(row);
  });
}

// -----------------------------------------------------
// MAJ personne existante
// -----------------------------------------------------
async function saveExistingPerson(updatedPerson) {
  const orgId = parseInt(orgSelect.value);
  const org = organizations.find(o => o.id === orgId);

  try {
    await upsertPerson(client, updatedPerson);

    const persons = org.persons.map(p => ({
      id: p.id,
      role: p.id === updatedPerson.id ? updatedPerson.role : p.role
    }));

    await upsertOrganization(client, {
      name: orgName.value.trim(),
      address: orgAddress.value.trim(),
      referent_id: org.referent_id,
      persons
    });

    alert("Personne mise à jour");
    await loadOrganizations();
  } catch (err) {
    alert("Erreur : " + formatServerError(err.message));
  }
}

// -----------------------------------------------------
// Détacher personne de l'organisation
// -----------------------------------------------------
async function detachPerson(id) {
  if (!confirm("Supprimer cette personne de cette organisation ?")) return;

  const orgId = parseInt(orgSelect.value);
  const org = organizations.find(o => o.id === orgId);

  const persons = (org.persons || []).filter(p => p.id !== id).map(p => ({ id: p.id, role: p.role || null }));

  try {
    await upsertOrganization(client, {
      name: orgName.value.trim(),
      address: orgAddress.value.trim(),
      referent_id: org.referent_id,
      persons
    });

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

  const persons = (org.persons || []).map(p => {
    const row = Array.from(document.querySelectorAll('.person-row-card')).find(r => r.querySelector('.pl-email').value === p.email);
    return {
      id: p.id,
      role: row ? row.querySelector('.pl-role').value.trim() || null : p.role || null
    };
  });

  try {
    await upsertOrganization(client, {
      name: orgName.value.trim(),
      address: orgAddress.value.trim(),
      referent_id: org.referent_id,
      persons
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
  const org = organizations.find(o => o.id === orgId);

  try {
    const person = await upsertPerson(client, {
      id: currentEditPersonId,
      first_name: pFirst.value.trim(),
      last_name: pLast.value.trim(),
      email: pEmail.value.trim(),
      phone: pPhone.value.trim()
    });

    let persons = (org.persons || []).map(p => ({ id: p.id, role: p.role || null }));

    const role = pRole.value.trim() || null;
    const existing = persons.find(p => p.id === person.id);

    if (existing) {
      existing.role = role;
    } else {
      persons.push({ id: person.id, role });
    }

    await upsertOrganization(client, {
      name: orgName.value.trim(),
      address: orgAddress.value.trim(),
      referent_id: org.referent_id,
      persons
    });

    alert(currentEditPersonId ? "Personne mise à jour" : "Personne ajoutée");

    currentEditPersonId = null;
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
