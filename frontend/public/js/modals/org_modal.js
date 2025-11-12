// js/modals/org_modal.js
import { initClient } from '../libs/client.js';
import { fetchOrganizations, upsertOrganization, fetchOrganizationReferents } from '../libs/sql/index.js';
import { formatServerError } from '../libs/helpers.js';
import { createModal } from '../libs/ui/createModal.js';

let client;
let modal, dialog;
let orgSelect, refSelect;
let currentOrgModalOpen = false;

// -----------------------------
// Charger modal dans le DOM
// -----------------------------
export async function loadOrgModal() {
  if (!document.getElementById('org-modal')) {
    const response = await fetch(`${window.ENV.BASE_PATH}/pages/org_modal.html`);
    if (!response.ok) throw new Error('Impossible de charger le modal organisation');
    const html = await response.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  modal = document.getElementById('org-modal');
  if (!modal) return;

  dialog = modal.querySelector('.org-modal-dialog');
  orgSelect = document.getElementById('organization');
  refSelect = document.getElementById('referent');

  // Bind bouton fermer
  const cancelBtn = document.getElementById('cancel-org-btn');
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', closeOrgModal);
    cancelBtn.dataset.bound = 'true';
  }

  // Bind bouton Ajouter / Modifier
  const addBtn = document.getElementById('add-edit-organization-btn');
  if (addBtn && !addBtn.dataset.bound) {
    addBtn.addEventListener('click', handleAddEditOrganization);
    addBtn.dataset.bound = 'true';
  }
}

// -----------------------------
// Ouvrir modal organisation
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
}

// -----------------------------
// Initialisation du modal
// -----------------------------
export async function initOrgModalBindings() {
  client = await initClient();
  await loadOrgModal();

  try {
    const [orgs, refs] = await Promise.all([
      fetchOrganizations(client),
      fetchOrganizationReferents(client)
    ]);

    if (orgSelect) {
      orgSelect.innerHTML = '';
      orgs.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        orgSelect.appendChild(opt);
      });
    }

    if (refSelect) {
      refSelect.innerHTML = '';
      refs.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        refSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('[Org Modal] Erreur chargement organisations / référents :', formatServerError(err.message || err));
  }
}

// -----------------------------
// Ajouter / Éditer organisation
// -----------------------------
export async function handleAddEditOrganization() {
  if (currentOrgModalOpen) return;
  currentOrgModalOpen = true;

  try {
    if (!orgSelect) throw new Error('Select organisation introuvable');

    const selectedOrgId = orgSelect.value || null;
    const selectedOrgName = orgSelect.options[orgSelect.selectedIndex]?.textContent || '';

    const fields = [
      { key: 'name', label: 'Nom de l’organisation', type: 'text', value: selectedOrgName },
      { key: 'email', label: 'Email', type: 'text', value: '' },
      { key: 'phone', label: 'Téléphone', type: 'text', value: '' },
      { key: 'private', label: 'Privée', type: 'checkbox', checked: false }
    ];

    createModal(
      selectedOrgId ? 'Modifier Organisation' : 'Ajouter Organisation',
      fields,
      async (updatedFields) => {
        try {
          const updatedOrga = await upsertOrganization(client, {
            id: selectedOrgId,
            name: updatedFields.name,
            email: updatedFields.email,
            phone: updatedFields.phone,
            private: updatedFields.private
          });

          // Refresh select
          const orgs = await fetchOrganizations(client);
          orgSelect.innerHTML = '';
          orgs.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name;
            orgSelect.appendChild(opt);
          });

          if (updatedOrga?.id) orgSelect.value = updatedOrga.id;

          // Rafraîchir référents
          const refs = await fetchOrganizationReferents(client);
          if (refSelect) {
            refSelect.innerHTML = '';
            refs.forEach(r => {
              const opt = document.createElement('option');
              opt.value = r.id;
              opt.textContent = r.name;
              refSelect.appendChild(opt);
            });
          }

        } catch (err) {
          console.error('[handleAddEditOrganization] Upsert erreur :', err);
          alert('Erreur lors de la sauvegarde : ' + err.message);
        } finally {
          currentOrgModalOpen = false;
        }
      }
    );

  } catch (err) {
    console.error('[handleAddEditOrganization] Erreur modal organisation :', err);
    alert('Impossible d’ouvrir le modal organisation : ' + err.message);
    currentOrgModalOpen = false;
  }
}
