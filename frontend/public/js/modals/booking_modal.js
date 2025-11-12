import { initClient } from '../libs/client.js';
import {
  fetchReservables,
  fetchOrganizations,
  fetchOrganizationReferents,
  upsertOrganization
} from '../libs/sql/index.js';
import { formatServerError } from '../libs/helpers.js';
import { createModal } from '../libs/ui/createModal.js';

let client;
let modal, dialog, itemsContainer, cancelBtn, validateBtn;
let bookingItems = [];


// -----------------------------
// Charger modal dans le DOM
// -----------------------------
export async function loadBookingModal() {
  if (!document.getElementById('booking-modal')) {
    const response = await fetch(`${window.ENV.BASE_PATH}/pages/booking_modal.html`);
    if (!response.ok) throw new Error('Impossible de charger le modal booking');
    const html = await response.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  modal = document.getElementById('booking-modal');
  if (!modal) return;

  dialog = modal.querySelector('.booking-modal-dialog');
  itemsContainer = document.getElementById('booking-items');
  cancelBtn = document.getElementById('cancel-booking-btn');
  validateBtn = document.getElementById('validate-booking-btn');

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', closeBookingModal);
    cancelBtn.dataset.bound = 'true';
  }

  // --- Bind du bouton "Ajouter / Modifier" (id présent dans ton HTML : #addOrg) ---
  const addOrgBtn = document.getElementById('add-edit-organization-btn');
  if (addOrgBtn && !addOrgBtn.dataset.bound) {
    addOrgBtn.addEventListener('click', handleAddEditOrganization);
    addOrgBtn.dataset.bound = 'true';
  }
}

// -----------------------------
// Ouvrir modal réservation
// -----------------------------
export async function openBookingModal(selectedItems = []) {
  await loadBookingModal();
  if (!modal || !dialog) return;

  bookingItems = selectedItems || [];
  renderBookingItems();

  dialog.classList.remove('show');
  modal.classList.remove('hidden');
  void dialog.offsetWidth; // reset animation
  dialog.classList.add('show');
}

// -----------------------------
// Fermer modal réservation
// -----------------------------
export function closeBookingModal() {
  if (!modal || !dialog) return;
  dialog.classList.remove('show');
  modal.classList.add('hidden');
}

// -----------------------------
// Afficher les items sélectionnés
// -----------------------------
export function renderBookingItems() {
  if (!itemsContainer) return;
  itemsContainer.innerHTML = '';
  bookingItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';

    const img = document.createElement('img');
    img.src = item.photos?.[0]?.url || 'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">
        <rect width="60" height="60" fill="#ddd"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-size="10">No Image</text>
      </svg>`);

    let hoverInterval, idx = 0;
    div.addEventListener('mouseenter', () => {
      if (!item.photos?.length) return;
      hoverInterval = setInterval(() => {
        idx = (idx + 1) % item.photos.length;
        img.src = item.photos[idx].url;
      }, 1000);
    });
    div.addEventListener('mouseleave', () => {
      clearInterval(hoverInterval);
      idx = 0;
      img.src = item.photos?.[0]?.url || img.src;
    });

    const info = document.createElement('div');
    info.style.flex = '1';
    const name = document.createElement('div');
    name.className = 'cart-item-name';
    name.textContent = item.name || '';
    const cat = document.createElement('div');
    cat.className = 'cart-item-cat';
    cat.textContent = item.category_name || '';
    info.appendChild(name);
    info.appendChild(cat);

    div.appendChild(img);
    div.appendChild(info);
    itemsContainer.appendChild(div);
  });
}

// -----------------------------
// Initialisation du modal
// -----------------------------
export async function initBookingModal() {
  client = await initClient();
  await loadBookingModal();

  try {
    const [orgs, refs] = await Promise.all([
      fetchOrganizations(client),
      fetchOrganizationReferents(client)
    ]);

    const orgSelect = document.getElementById('organization');
    const refSelect = document.getElementById('referent');

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
    console.error('[Booking Modal] Erreur chargement organisations / référents :', formatServerError(err.message || err));
  }
}



let currentOrgModalOpen = false; // ⚡ garde trace si le modal est déjà ouvert

// -----------------------------
// Corps du listener "Ajouter / Éditer Organisation"
// -----------------------------
export async function handleAddEditOrganization() {
  if (currentOrgModalOpen) return; // ⚡ éviter plusieurs modals ouverts en même temps
  currentOrgModalOpen = true;

  try {
    const orgSelect = document.getElementById('organization');
    if (!orgSelect) throw new Error('Select organisation introuvable');

    const selectedOrgId = orgSelect.value || null;
    const selectedOrgName = orgSelect.options[orgSelect.selectedIndex]?.textContent || '';

    // Champs pour le modal
    const fields = [
      { key: 'name', label: 'Nom de l’organisation', type: 'text', value: selectedOrgName },
      { key: 'email', label: 'Email', type: 'text', value: '' },
      { key: 'phone', label: 'Téléphone', type: 'text', value: '' },
      { key: 'private', label: 'Privée', type: 'checkbox', checked: false }
    ];

    // Création du modal via createModal
    createModal(
      selectedOrgId ? 'Modifier Organisation' : 'Ajouter Organisation',
      fields,
      async (updatedFields) => {
        try {
          // ⚡ Upsert organisation
          const updatedOrga = await upsertOrganization(client, {
            id: selectedOrgId,
            name: updatedFields.name,
            email: updatedFields.email,
            phone: updatedFields.phone,
            private: updatedFields.private
          });

          // 🔄 Mettre à jour le select organisation
          const orgs = await fetchOrganizations(client);
          orgSelect.innerHTML = '';
          orgs.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name;
            orgSelect.appendChild(opt);
          });

          // 🔹 Reselect l’organisation modifiée
          if (updatedOrga?.id) orgSelect.value = updatedOrga.id;

          // 🔄 Rafraîchir les référents pour l’organisation sélectionnée
          await refreshReferentsForSelectedOrg();

        } catch (err) {
          console.error('[handleAddEditOrganization] Upsert erreur:', err);
          alert('Erreur lors de la sauvegarde : ' + err.message);
        } finally {
          currentOrgModalOpen = false; // ⚡ libération état modal
        }
      }
    );

  } catch (err) {
    console.error('[handleAddEditOrganization] Erreur modal organisation :', err);
    alert('Impossible d’ouvrir le modal organisation : ' + err.message);
    currentOrgModalOpen = false; // ⚡ libérer même en cas d’erreur
  }
}

// -----------------------------
// Bind du bouton "Ajouter / Modifier" dans loadBookingModal
// -----------------------------
const addOrgBtn = document.getElementById('add-edit-organization-btn');
if (addOrgBtn && !addOrgBtn.dataset.bound) {
  addOrgBtn.addEventListener('click', handleAddEditOrganization);
  addOrgBtn.dataset.bound = 'true';
}
