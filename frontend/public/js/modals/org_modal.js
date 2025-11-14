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
  if (!document.getElementById('booking-modal')) {
    const response = await fetch(`${window.ENV.BASE_PATH}/pages/org_modal.html`);
    if (!response.ok) throw new Error('Impossible de charger le modal org');
    const html = await response.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  modal = document.getElementById('booking-modal');
  if (!modal) return;

  dialog = modal.querySelector('.org-modal-dialog');

}

// -----------------------------
// Ouvrir modal réservation
// -----------------------------
export async function openOrgModal() {
  await loadOrgModal();
  if (!modal || !dialog) return;


  dialog.classList.remove('show');
  modal.classList.remove('hidden');
  void dialog.offsetWidth; // reset animation
  dialog.classList.add('show');
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
// Initialisation du contenu du modal
// -----------------------------
async function initModalData() {

}

// -----------------------------
// Initialisation client
// -----------------------------
export async function initOrgModal() {
  client = await initClient();
  await loadOrgModal();
}
