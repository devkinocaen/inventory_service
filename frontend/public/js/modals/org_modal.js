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
  deleteBtn = dialog.querySelector('.org-btn-delete');

  // Event listeners
  addPersonBtn?.addEventListener('click', () => addPersonItem());
  cancelBtn?.addEventListener('click', () => closeOrgModal());
  saveBtn?.addEventListener('click', () => saveOrganization());
  deleteBtn?.addEventListener('click', () => confirmDeleteOrganization());

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
// Ajouter une personne (UI + RPC)
// -----------------------------
async function addPersonItem(person = {}) {
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

  // Supprimer la personne
  div.querySelector('.person-remove-btn').addEventListener('click', async () => {
    try {
      const firstName = div.querySelector('.person-firstname').value;
      const lastName = div.querySelector('.person-lastname').value;
      if (firstName && lastName) {
        await deletePerson(client, { first_name: firstName, last_name: lastName });
      }
      div.remove();

      // Si la personne supprimée était le referent sélectionné, remettre le placeholder
      if (orgReferentSelect && orgReferentSelect.value === `${firstName} ${lastName}`) {
        orgReferentSelect.value = '';
      }
    } catch (err) {
      console.error('[deletePerson] ', err);
    }
  });

  const firstNameInput = div.querySelector('.person-firstname');
  const lastNameInput = div.querySelector('.person-lastname');
  const emailInput = div.querySelector('.person-email');
  const phoneInput = div.querySelector('.person-phone');
  const roleInput = div.querySelector('.person-role');

  // Upsert la personne quand on quitte un champ
  div.querySelectorAll('input').forEach(input => {
    input.addEventListener('blur', async () => {
      const first_name = firstNameInput.value.trim();
      const last_name = lastNameInput.value.trim();
      if (first_name && last_name) {
        try {
          const email = emailInput.value || null;
          const phone = phoneInput.value || null;
          const role = roleInput.value || null;
          const savedPerson = await upsertPerson(client, { first_name, last_name, email, phone, role });

          // Mettre à jour le select referent si encore sur placeholder
          if (orgReferentSelect && !orgReferentSelect.value) {
            // Ajouter l'option si elle n'existe pas encore
            if (!Array.from(orgReferentSelect.options).some(opt => opt.value === `${savedPerson.first_name} ${savedPerson.last_name}`)) {
              const option = document.createElement('option');
              option.value = `${savedPerson.first_name} ${savedPerson.last_name}`;
              option.textContent = `${savedPerson.first_name} ${savedPerson.last_name}`;
              orgReferentSelect.appendChild(option);
            }
            orgReferentSelect.value = `${savedPerson.first_name} ${savedPerson.last_name}`;
          }

        } catch (err) {
          console.error('[upsertPerson] ', err);
        }
      }
    });
  });

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
    
    // Mettre à jour l'UI
    if (orgSelect) {
      const option = orgSelect.querySelector(`option[value="${selectedOrgId}"]`);
      if (option) option.remove();
      orgSelect.value = ''; // reset sélection
    }

    closeOrgModal();
  } catch (err) {
    console.error('[deleteOrganization]', err);
    alert('Erreur lors de la suppression de l’organisation');
  }
}
