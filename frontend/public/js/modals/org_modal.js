import { initClient } from '../libs/client.js';
import {
  fetchOrganizations,
  upsertOrganization,
  upsertPerson
} from '../libs/sql/index.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let modal, dialog;
let orgSelect, orgNameInput, orgAddressInput, orgReferentSelect;
let personList, addPersonBtn, cancelBtn, saveBtn;

let organizations = [];
let referents = [];
let selectedOrgId = null;
let currentOrgModalOpen = false;

// -----------------------------
// Charger le modal dans le DOM
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

  // Event listeners
  addPersonBtn?.addEventListener('click', () => addPersonItem());
  cancelBtn?.addEventListener('click', () => closeOrgModal());
  saveBtn?.addEventListener('click', () => saveOrganization());
}

// -----------------------------
// Ouvrir modal organisation
// -----------------------------
export async function openOrgModal() {
  await loadOrgModal();
  if (!modal || !dialog) return;

  modal.classList.remove('hidden');
  void dialog.offsetWidth; // trigger reflow pour l'animation
  dialog.classList.add('show');
  currentOrgModalOpen = true;
}

// -----------------------------
// Fermer modal organisation
// -----------------------------
export function closeOrgModal() {
  if (!modal || !dialog) return;
  dialog.classList.remove('show');
  modal.classList.add('hidden');
  currentOrgModalOpen = false;
}

// -----------------------------
// Ajouter une personne (UI)
// -----------------------------
function addPersonItem(person = {}) {
  if (!personList) return;
  const div = document.createElement('div');
  div.className = 'person-item';
  div.innerHTML = `
    <input type="text" placeholder="Nom" class="person-lastname" value="${person.last_name || ''}" />
    <input type="text" placeholder="Prénom" class="person-firstname" value="${person.first_name || ''}" />
    <input type="email" placeholder="Email" class="person-email" value="${person.email || ''}" />
    <input type="text" placeholder="Téléphone" class="person-phone" value="${person.phone || ''}" />
    <input type="text" placeholder="Rôle" class="person-role" value="${person.role || ''}" />
    <button type="button" class="person-remove-btn">✕</button>
  `;
  div.querySelector('.person-remove-btn').addEventListener('click', () => div.remove());
  personList.appendChild(div);
}

// -----------------------------
// Sauvegarder organisation et personnes
// -----------------------------
async function saveOrganization() {
  if (!orgNameInput) return;
  const orgData = {
    name: orgNameInput.value,
    address: orgAddressInput.value,
    referent_id: orgReferentSelect?.value || null
  };
  try {
    const savedOrg = await upsertOrganization(orgData);
    console.log('Organisation enregistrée', savedOrg);
    // On peut aussi sauvegarder les personnes si besoin
    closeOrgModal();
  } catch (err) {
    console.error(formatServerError(err));
  }
}

// -----------------------------
// Initialisation client
// -----------------------------
export async function initOrgModal() {
  client = await initClient();
  await loadOrgModal();
}
