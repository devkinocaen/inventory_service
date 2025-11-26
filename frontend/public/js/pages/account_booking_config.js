// js/ui/user_modal.js
import { initClient } from '../libs/client.js';
import { upsertPerson, deletePerson } from '../libs/sql/index.js';

let client;
let modal, dialog;
let userList, addUserBtn, cancelBtn, saveBtn;

let currentUserModalOpen = false;

// -----------------------------
// Initialisation client et modal
// -----------------------------
export async function initUserModal() {
  client = await initClient();
  await loadUserModal();
}

// -----------------------------
// Charger le modal HTML
// -----------------------------
export async function loadUserModal() {
  if (!document.getElementById('user-modal')) {
    const response = await fetch(`${window.ENV.BASE_PATH}/pages/user_modal.html`);
    if (!response.ok) throw new Error('Impossible de charger le modal user');
    const html = await response.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  modal = document.getElementById('user-modal');
  if (!modal) return;

  dialog = modal.querySelector('.user-modal-dialog');

  // Inputs et boutons
  userList = dialog.querySelector('#userList');
  addUserBtn = dialog.querySelector('.user-add-btn');
  cancelBtn = dialog.querySelector('.user-btn-cancel');
  saveBtn = dialog.querySelector('.user-btn-save');

  // Event listeners
  addUserBtn?.addEventListener('click', onAddUserClick);
  cancelBtn?.addEventListener('click', closeUserModal);
  saveBtn?.addEventListener('click', saveAllUsers);
}

// -----------------------------
// Ouvrir / Fermer modal
// -----------------------------
export function openUserModal() {
  if (!modal || !dialog) return;
  modal.classList.remove('hidden');
  void dialog.offsetWidth; // trigger reflow pour animation
  dialog.classList.add('show');
  currentUserModalOpen = true;

  // on charge une ligne vide au démarrage
  if (!userList.querySelector('.user-item')) addUserRow();
}

export function closeUserModal() {
  if (!modal || !dialog) return;
  dialog.classList.remove('show');
  modal.classList.add('hidden');
  currentUserModalOpen = false;
}

// -----------------------------
// Handler du clic "Ajouter Utilisateur"
function onAddUserClick() {
  const rows = Array.from(userList.querySelectorAll('.user-item'));
  const lastRow = rows[rows.length - 1];

  if (lastRow) {
    const fn = lastRow.querySelector('.user-firstname')?.value.trim() || '';
    const ln = lastRow.querySelector('.user-lastname')?.value.trim() || '';

    if (fn && ln) {
      createUserFromRow(lastRow).then(() => addUserRow())
        .catch(err => {
          console.error('[createUserFromRow]', err);
          addUserRow();
        });
      return;
    }
  }

  addUserRow();
}

// -----------------------------
// Ajoute une ligne de personne dans l'UI
function addUserRow(user = {}) {
  const div = document.createElement('div');
  div.className = 'user-item';
  if (user.id) div.dataset.userId = String(user.id);

  div.innerHTML = `
    <input type="text" placeholder="Nom" class="user-lastname" value="${escapeHtml(user.last_name || '')}" />
    <input type="text" placeholder="Prénom" class="user-firstname" value="${escapeHtml(user.first_name || '')}" />
    <input type="email" placeholder="Email" class="user-email" value="${escapeHtml(user.email || '')}" />
    <input type="text" placeholder="Téléphone" class="user-phone" value="${escapeHtml(user.phone || '')}" />
    <button type="button" class="user-remove-btn">✕</button>
  `;

  // remove handler
  div.querySelector('.user-remove-btn').addEventListener('click', async () => {
    try {
      const fn = div.querySelector('.user-firstname')?.value.trim();
      const ln = div.querySelector('.user-lastname')?.value.trim();

      if (fn && ln) {
        try {
          await deletePerson(client, { first_name: fn, last_name: ln });
        } catch (err) {
          console.warn('[deletePerson] rpc error (ignored):', err);
        }
      }

      div.remove();
    } catch (err) {
      console.error('[remove user]', err);
    }
  });

  // blur handlers pour upsertPerson
  const firstNameInput = div.querySelector('.user-firstname');
  const lastNameInput = div.querySelector('.user-lastname');
  const emailInput = div.querySelector('.user-email');
  const phoneInput = div.querySelector('.user-phone');

  [firstNameInput, lastNameInput, emailInput, phoneInput].forEach(el => {
    el.addEventListener('blur', async () => {
      const first_name = firstNameInput.value.trim();
      const last_name = lastNameInput.value.trim();
      if (!first_name || !last_name) return;

      try {
        const saved = await upsertPerson(client, {
          first_name,
          last_name,
          email: emailInput.value.trim() || null,
          phone: phoneInput.value.trim() || null,
          address: null
        });

        if (saved && saved.id) div.dataset.userId = String(saved.id);
      } catch (err) {
        console.error('[upsertPerson] failed on blur', err);
      }
    });
  });

  userList.appendChild(div);
  firstNameInput.focus();
}

// -----------------------------
// Crée la personne à partir d'une ligne DOM
async function createUserFromRow(row) {
  const first_name = row.querySelector('.user-firstname')?.value.trim() || '';
  const last_name = row.querySelector('.user-lastname')?.value.trim() || '';
  const email = row.querySelector('.user-email')?.value.trim() || null;
  const phone = row.querySelector('.user-phone')?.value.trim() || null;

  if (!first_name || !last_name) throw new Error('Prénom et nom requis');

  const saved = await upsertPerson(client, { first_name, last_name, email, phone, address: null });

  if (saved?.id) row.dataset.userId = String(saved.id);

  return saved;
}

// -----------------------------
// Sauvegarde manuelle de tous les users
async function saveAllUsers() {
  const rows = Array.from(userList.querySelectorAll('.user-item'));
  for (const row of rows) {
    try {
      await createUserFromRow(row);
    } catch (err) {
      console.error('[saveAllUsers] failed', err);
    }
  }
  alert('✅ Utilisateurs sauvegardés.');
}

// -----------------------------
// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
