// js/ui/org_modal.js
import { initClient } from '../libs/client.js';
import {
  fetchOrganizations,
  upsertOrganization,
  upsertPerson,
  deletePerson,
  deleteOrganization
} from '../libs/sql/index.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let modal, dialog;
let orgSelect, orgNameInput, orgAddressInput, orgReferentSelect;
let personList, addPersonBtn, cancelBtn, deleteBtn, saveBtn;

let organizations = [];
let selectedOrgId = null;
let currentOrgModalOpen = false;

// -----------------------------
// Initialisation client et modal
// -----------------------------
export async function initOrgModal() {
  client = await initClient();
  await loadOrgModal();
}

// -----------------------------
// Charger le modal HTML
// -----------------------------
export async function loadOrgModal() {
  if (!document.getElementById('org-modal')) {
    const response = await fetch(`${window.ENV.BASE_PATH}/pages/org_modal.html`);
    if (!response.ok) throw new Error('Impossible de charger le modal org');
    const html = await response.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  modal = document.getElementById('org-modal');
  if (!modal) return;

  dialog = modal.querySelector('.org-modal-dialog');

  // Inputs et boutons
  orgSelect = dialog.querySelector('#organizationSelect');
  orgNameInput = dialog.querySelector('#organizationName');
  orgAddressInput = dialog.querySelector('#organizationAddress');
  orgReferentSelect = dialog.querySelector('#organizationReferent');
  personList = dialog.querySelector('#personList');
  addPersonBtn = dialog.querySelector('.person-add-btn');
  cancelBtn = dialog.querySelector('.org-btn-cancel');
  saveBtn = dialog.querySelector('.org-btn-save');
  deleteBtn = dialog.querySelector('.org-btn-delete');

  // Event listeners
  addPersonBtn?.addEventListener('click', onAddPersonClick);
  cancelBtn?.addEventListener('click', closeOrgModal);
  saveBtn?.addEventListener('click', saveOrganization);
  deleteBtn?.addEventListener('click', confirmDeleteOrganization);

  orgSelect?.addEventListener('change', e => {
    const id = e.target.value;
    if (id) selectOrganization(id);
    else resetModal();
  });
    
    // 🔹 Ajouter écouteur ESCAPE
    const escListener = (e) => {
      if (e.key === 'Escape') {
         document.removeEventListener('keydown', escListener);
        closeOrgModal();
      }
    };
    document.addEventListener('keydown', escListener);

  await loadOrganizations();
}

// -----------------------------
// Ouvrir / Fermer modal
// -----------------------------
export async function openOrgModal() {
  await initOrgModal();
  if (!modal || !dialog) return;

  modal.classList.remove('hidden');
  void dialog.offsetWidth; // trigger reflow pour animation
  dialog.classList.add('show');
  currentOrgModalOpen = true;
}

export function closeOrgModal() {
  if (!modal || !dialog) return;
  dialog.classList.remove('show');
  modal.classList.add('hidden');
  currentOrgModalOpen = false;
}

// -----------------------------
// Réinitialiser modal
// -----------------------------
function resetModal() {
  selectedOrgId = null;
  orgNameInput.value = '';
  orgAddressInput.value = '';
  personList.innerHTML = '';
  orgReferentSelect.innerHTML = '<option value="">-- Choisir un référent --</option>';
}

// -----------------------------
// Handler du clic "Ajouter Personne"
// - Si dernière ligne contient prénom+nom -> crée en DB, update select, ajoute ligne vide
// - Sinon ajoute simplement une ligne vide (focus prénom)
// -----------------------------
function onAddPersonClick() {
  // get last row if exists
  const rows = Array.from(personList.querySelectorAll('.person-item'));
  const lastRow = rows[rows.length - 1];

  if (lastRow) {
    const fn = lastRow.querySelector('.person-firstname')?.value.trim() || '';
    const ln = lastRow.querySelector('.person-lastname')?.value.trim() || '';

    if (fn && ln) {
      // create person from last row, then add a new empty row
      createPersonFromRow(lastRow).then(() => {
        addPersonRow(); // new empty row for next entry
      }).catch(err => {
        console.error('[createFromRow]', err);
        // still add an empty row so user can continue
        addPersonRow();
      });
      return;
    }
  }

  // no last row or last row empty -> just add empty row
  addPersonRow();
}

// -----------------------------
// Ajoute une ligne de personne dans l'UI (optionnellement pré-remplie)
// - person: { id?, first_name, last_name, email, phone, role }
// -----------------------------
function addPersonRow(person = {}) {
  const div = document.createElement('div');
  div.className = 'person-item';
  if (person.id) div.dataset.personId = String(person.id);
  else div.dataset.personId = '';

  div.innerHTML = `
    <input type="text" placeholder="Nom" class="person-lastname" value="${escapeHtml(person.last_name || '')}" />
    <input type="text" placeholder="Prénom" class="person-firstname" value="${escapeHtml(person.first_name || '')}" />
    <input type="email" placeholder="Email" class="person-email" value="${escapeHtml(person.email || '')}" />
    <input type="text" placeholder="Téléphone" class="person-phone" value="${escapeHtml(person.phone || '')}" />
    <input type="text" placeholder="Rôle" class="person-role" value="${escapeHtml(person.role || '')}" />
    <button type="button" class="person-remove-btn">✕</button>
  `;

  // remove handler
  div.querySelector('.person-remove-btn').addEventListener('click', async () => {
    try {
      const fn = div.querySelector('.person-firstname')?.value.trim();
      const ln = div.querySelector('.person-lastname')?.value.trim();

      // call deletePerson RPC if we have names (deletePerson signature expects first_name + last_name)
      if (fn && ln) {
        try {
          await deletePerson(client, { first_name: fn, last_name: ln });
        } catch (err) {
          // log but continue removing from UI
          console.warn('[deletePerson] rpc error (ignored) :', err);
        }
      }

      div.remove();
      updateReferentSelect();
    } catch (err) {
      console.error('[remove person]', err);
    }
  });

  // blur handlers: when user leaves inputs, if first+last present -> upsertPerson
  const firstNameInput = div.querySelector('.person-firstname');
  const lastNameInput = div.querySelector('.person-lastname');
  const emailInput = div.querySelector('.person-email');
  const phoneInput = div.querySelector('.person-phone');
  const roleInput = div.querySelector('.person-role');

  // on blur (we attach to each field)
  [firstNameInput, lastNameInput, emailInput, phoneInput, roleInput].forEach(el => {
    el.addEventListener('blur', async () => {
      const first_name = firstNameInput.value.trim();
      const last_name = lastNameInput.value.trim();
      if (!first_name || !last_name) {
        // don't attempt to create person without both names
        return;
      }

      try {
        const saved = await upsertPerson(client, {
          first_name,
          last_name,
          email: emailInput.value.trim() || null,
          phone: phoneInput.value.trim() || null,
          address: null
        });

        // saved is single(data) from upsertPerson.js -> an object
        if (saved && saved.id) {
          div.dataset.personId = String(saved.id);
        }

        // ensure referent select contains this person as option (value = id)
        ensureReferentOption(saved);
        updateReferentSelect(); // rebuild options keeping selection

      } catch (err) {
        console.error('[upsertPerson] failed on blur', err);
      }
    });
  });

  personList.appendChild(div);
  // focus first name for convenience
  const inputToFocus = div.querySelector('.person-firstname');
  if (inputToFocus) inputToFocus.focus();
  updateReferentSelect();
}

// -----------------------------
// Crée la personne à partir d'une ligne DOM existante (row element)
// - retourne l'objet person retourné par upsertPerson
// -----------------------------
async function createPersonFromRow(row) {
  const firstNameInput = row.querySelector('.person-firstname');
  const lastNameInput = row.querySelector('.person-lastname');
  const emailInput = row.querySelector('.person-email');
  const phoneInput = row.querySelector('.person-phone');
  const roleInput = row.querySelector('.person-role');

  const first_name = firstNameInput?.value.trim() || '';
  const last_name = lastNameInput?.value.trim() || '';

  if (!first_name || !last_name) {
    throw new Error('Prénom et nom requis pour créer la personne');
  }

  const email = emailInput?.value.trim() || null;
  const phone = phoneInput?.value.trim() || null;
  const role = roleInput?.value.trim() || null;

  const saved = await upsertPerson(client, {
    first_name,
    last_name,
    email,
    phone,
    address: null
  });

  if (saved && saved.id) {
    row.dataset.personId = String(saved.id);
  }

  // ensure select has the option and if it's currently placeholder, set it
  ensureReferentOption(saved);

  return saved;
}

// -----------------------------
// Ensure referent select contains the person as option (value = id)
// If select is currently on placeholder (empty), set it to this id
// -----------------------------
function ensureReferentOption(person) {
  if (!orgReferentSelect || !person) return;
  const id = person.id ? String(person.id) : null;
  const label = `${person.first_name || ''} ${person.last_name || ''}`.trim();
  if (!id) return; // we only add options with id (we rely on DB ids)

  // add option if not exists
  if (!Array.from(orgReferentSelect.options).some(opt => opt.value === id)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    orgReferentSelect.appendChild(option);
  }

  // if select is empty/placeholder, set to this new person
  if (!orgReferentSelect.value) {
    orgReferentSelect.value = id;
  }
}

// -----------------------------
// Mettre à jour le select référent (rebuild from rows)
// - option.value = dataset.personId (if present) otherwise skip
// -----------------------------
function updateReferentSelect() {
  if (!orgReferentSelect) return;
  const selectedValue = orgReferentSelect.value;
  // keep the placeholder
  orgReferentSelect.innerHTML = '<option value="">-- Choisir un référent --</option>';

  Array.from(personList.children).forEach(div => {
    const fn = div.querySelector('.person-firstname')?.value.trim();
    const ln = div.querySelector('.person-lastname')?.value.trim();
    const pid = div.dataset.personId || '';
    if (!fn || !ln) return;
    // only include persons that have an id (we rely on id for upsertOrganization)
    if (!pid) return;
    const option = document.createElement('option');
    option.value = pid;
    option.textContent = `${fn} ${ln}`;
    orgReferentSelect.appendChild(option);
  });

  if (selectedValue) {
    // if selectedValue still exists, keep it; otherwise reset to placeholder
    if (Array.from(orgReferentSelect.options).some(o => o.value === selectedValue)) {
      orgReferentSelect.value = selectedValue;
    } else {
      orgReferentSelect.value = '';
    }
  }
}

// -----------------------------
// Charger toutes les organisations et remplir le select
// -----------------------------
async function loadOrganizations() {
  if (!client) client = await initClient();
  organizations = await fetchOrganizations(client);
  if (!orgSelect) return;
   orgSelect.innerHTML = '<option value="">-- Choisir une organisation --</option>';
  organizations.forEach(org => {
    const opt = document.createElement('option');
    opt.value = org.id;
    opt.textContent = org.name;
    orgSelect.appendChild(opt);
  });
}

// -----------------------------
// Sélectionner une organisation existante
// -----------------------------
function selectOrganization(orgId) {
  resetModal();
  selectedOrgId = orgId;
  const org = organizations.find(o => String(o.id) === String(orgId));
  if (!org) return;

  orgNameInput.value = org.name || '';
  orgAddressInput.value = org.address || '';

  // ajouter le référent si présent
  if (org.referent_id) {
    addPersonRow({
      id: org.referent_id,
      first_name: org.referent_first_name || '',
      last_name: org.referent_last_name || '',
      email: org.referent_email || '',
      phone: org.referent_phone || '',
      role: 'Référent'
    });
  }

  // ajouter les autres personnes
  (org.persons || []).forEach(p => {
    if (org.referent_id && String(p.id) === String(org.referent_id)) return;
    addPersonRow({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      role: p.role || ''
    });
  });

  // si pas de lignes, ajouter une vide
  if (!personList.querySelector('.person-item')) addPersonRow();

  // **mettre à jour le select référent pour refléter l'organisation sélectionnée**
  updateReferentSelect();

  // si org.referent_id est défini, forcer la sélection
  if (org.referent_id) {
    orgReferentSelect.value = String(org.referent_id);
  }
}


// -----------------------------
// Sauvegarder organisation
// - upsertOrganization expects referent_id and person_roles (array)
// -----------------------------
async function saveOrganization() {
  if (!orgNameInput.value.trim()) {
    alert('Le nom de l’organisation est obligatoire.');
    return;
  }

  // Collecte toutes les personnes visibles dans la liste
  const rows = Array.from(personList.querySelectorAll('.person-item'));
  const persons = [];

  for (const row of rows) {
    const fn = row.querySelector('.person-firstname')?.value.trim() || '';
    const ln = row.querySelector('.person-lastname')?.value.trim() || '';
    const email = row.querySelector('.person-email')?.value.trim() || null;
    const phone = row.querySelector('.person-phone')?.value.trim() || null;
    const role = row.querySelector('.person-role')?.value.trim() || null; // récupère le rôle

    if (!fn || !ln) continue; // ignore les lignes vides

    let personId = row.dataset.personId;

    if (!personId) {
      try {
        const saved = await upsertPerson(client, { first_name: fn, last_name: ln, email, phone, address: null });
        if (saved?.id) {
          personId = String(saved.id);
          row.dataset.personId = personId;
        }
      } catch (err) {
        console.error('[saveOrganization] upsertPerson failed', err);
        alert('Erreur lors de la sauvegarde d’une personne. Voir console.');
        return;
      }
    }

    persons.push({ id: Number(personId), role });
  }

  const referentId = orgReferentSelect.value || null;
  if (!referentId) {
    alert('Le référent est obligatoire pour créer/modifier une organisation.');
    return;
  }

  const orgData = {
    id: selectedOrgId || null,
    name: orgNameInput.value.trim(),
    address: orgAddressInput.value.trim() || null,
    referent_id: Number(referentId),
    persons // tableau { id, role }
  };

  try {
    const savedOrg = await upsertOrganization(client, orgData);
    console.log('Organisation enregistrée', savedOrg);
    await loadOrganizations();
    if (orgSelect) orgSelect.value = savedOrg.id;

    alert('✅ Organisation enregistrée avec succès.');

  } catch (err) {
    console.error('[upsertOrganization]', err);
    alert(`❌ Impossible d’enregistrer :\n\n${err.message}`);
  }
}


// -----------------------------
// Supprimer organisation
// -----------------------------
async function confirmDeleteOrganization() {
  if (!selectedOrgId) return;

  const confirmed = window.confirm(
    'Voulez-vous vraiment supprimer cette organisation ? Cette action est irréversible.'
  );
  if (!confirmed) return;

  try {
    await deleteOrganization(client, selectedOrgId);
    console.log(`Organisation ${selectedOrgId} supprimée`);

    if (orgSelect) {
      const option = orgSelect.querySelector(`option[value="${selectedOrgId}"]`);
      if (option) option.remove();
      orgSelect.value = '';
    }

  } catch (err) {
    console.error('[deleteOrganization]', err);
    alert('Erreur lors de la suppression de l’organisation');
  }
}

// -----------------------------
// Small helper to escape HTML in values inserted into innerHTML
// -----------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
