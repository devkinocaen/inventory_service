import { initClient } from '../libs/client.js';
import {
  fetchOrganizations,
  fetchOrganizationsByPersonId,
  createBatch,
  upsertBookingReference,
  createBooking,
  isAvailable,
  fetchAppConfig
} from '../libs/sql/index.js';
 
import {
    formatServerError,
    formatDateForDatetimeLocal,
    roundDateByMinute
} from '../libs/helpers.js';

import { displayImage } from '../libs/image_utils.js';

import { populateSelect } from '../libs/ui/populateSelect.js';

let client =  null;
let appConfig =  null;
let modal, dialog, itemsContainer, cancelBtn, validateBtn;
let orgSelect, bookingPersonSelect, startDateInput, endDateInput;
let bookingItems = [];
let organizations = [];
let priceInput;
let personId = null;
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
  dialog = modal.querySelector('.booking-modal-dialog');
  itemsContainer = document.getElementById('booking-items');
  cancelBtn = document.getElementById('cancel-booking-btn');
  validateBtn = document.getElementById('validate-booking-btn');

  orgSelect = document.getElementById('organization');
  bookingPersonSelect = document.getElementById('booking_person');
  startDateInput = document.getElementById('startDate');
  endDateInput = document.getElementById('endDate');
  priceInput = document.getElementById('price');

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', closeBookingModal);
    cancelBtn.dataset.bound = 'true';
  }

  if (validateBtn && !validateBtn.dataset.bound) {
    validateBtn.addEventListener('click', handleBookingValidate);
    validateBtn.dataset.bound = 'true';
  }

  if (orgSelect && !orgSelect.dataset.bound) {
    orgSelect.addEventListener('change', updateBookingPersons);
    orgSelect.dataset.bound = 'true';
  }
    
    // Fermeture avec ESC
    if (!modal.dataset.escBound) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          document.removeEventListener('keydown', escListener);
          closeBookingModal();
        }
      });
      modal.dataset.escBound = "true";
    }

    
    // Désactivation automatique du checkbox "immediate_checkout" selon le rôle
    const immediateCheckoutCheckbox = document.getElementById('immediate_checkout');

    if (immediateCheckoutCheckbox) {
      let userRole = 'viewer';

      try {
        const raw = localStorage.getItem("loggedUser");
        if (raw) {
          const logged = JSON.parse(raw);
          if (logged?.role) userRole = logged.role;
        }
      } catch (e) {
        console.warn("[Booking Modal] Impossible de lire loggedUser", e);
      }

      if (userRole === 'viewer') {
        immediateCheckoutCheckbox.checked = false;   // Ne jamais laisser coché
        immediateCheckoutCheckbox.disabled = true;   // Interdit aux viewers
      } else {
        immediateCheckoutCheckbox.disabled = false;  // Autorisé pour admin / manager
      }
    }
}

// -----------------------------
// Ouvrir modal réservation
// -----------------------------
export async function openBookingModal(selectedItems = [], dates = {}) {
  if (!selectedItems || selectedItems.length === 0) {
    alert('Aucun article sélectionné pour la réservation.');
    return;
  }

  await initBookingModal();
  if (!modal || !dialog) return;

  bookingItems = selectedItems || [];
  renderBookingItems();
    
  // --------------------------
  // Initialisation date/heure
  // --------------------------
  const { start, end } = dates ?? {};

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

  const startInit = start
    ? roundDateByMinute(start, 'down')
    : formatDateForDatetimeLocal(now);

  const endInit = end
    ? roundDateByMinute(end, 'up')
    : formatDateForDatetimeLocal(tomorrow);

  startDateInput.value = startInit;
  endDateInput.value = endInit;

    updateBookingPrice();

    startDateInput.addEventListener('change', updateBookingPrice);
    endDateInput.addEventListener('change', updateBookingPrice);

    
  // --------------------------
  dialog.classList.remove('show');
  modal.classList.remove('hidden');
  void dialog.offsetWidth;
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
export async function renderBookingItems() {
  if (!itemsContainer) return;
  itemsContainer.innerHTML = '';

  for (const item of bookingItems) {
    const div = document.createElement('div');
    div.className = 'cart-item';

    const imgContainer = document.createElement('div');
    imgContainer.style.width = '60px';
    imgContainer.style.height = '60px';
    imgContainer.style.flexShrink = '0';
    imgContainer.style.overflow = 'hidden';
    imgContainer.style.borderRadius = '4px';
    div.appendChild(imgContainer);

    // Affichage initial de l'image avec displayImage
    const firstPhoto = item.photos?.[0];
    if (firstPhoto) {
      await displayImage(client, imgContainer, firstPhoto.url, { width: '60px', height: '60px', withPreview: true });
    } else {
      // Placeholder si pas de photo
      imgContainer.innerHTML = `<img src="https://placehold.co/60x60?text=+" style="width:100%;height:100%;object-fit:cover">`;
    }

    // Hover pour faire défiler les photos
    if (item.photos?.length > 1) {
      let idx = 0;
      let intervalId = null;

      div.addEventListener('mouseenter', () => {
        intervalId = setInterval(async () => {
          idx = (idx + 1) % item.photos.length;
          await displayImage(client, imgContainer, item.photos[idx].url, { width: '60px', height: '60px' });
        }, 1000);
      });

      div.addEventListener('mouseleave', async () => {
        if (intervalId) clearInterval(intervalId);
        idx = 0;
        await displayImage(client, imgContainer, firstPhoto.url, { width: '60px', height: '60px' });
      });
    }

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

    div.appendChild(info);
    itemsContainer.appendChild(div);
  }
}


// -----------------------------
// Initialisation du modal
// -----------------------------
export async function initBookingModal() {
    client = client || await initClient();
    appConfig = await fetchAppConfig(client);

    await loadBookingModal();

   try {
     const loggedUser = JSON.parse(localStorage.getItem("loggedUser") || "{}");
       if (loggedUser.role == 'viewer') {
         personId = typeof loggedUser.personId === "number" || typeof loggedUser.personId === "string"
           ? loggedUser.personId
           : null;
       }
   } catch (e) {
     console.error("❌ Erreur lecture loggedUser :", e);
   }


    try {
        // 🔹 Récupérer les organisations liées à personId
        organizations = personId
            ? await fetchOrganizationsByPersonId(client, personId)
            : await fetchOrganizations(client);
         populateSelect(orgSelect, organizations, null, {
            labelField: 'name',
            placeholder: '-- Choisir une organisation --'
        });
       if (personId && Array.isArray(organizations) && organizations.length > 0 && orgSelect) {
           const firstOrgId = organizations[0]?.id;
           if (firstOrgId != null) {
               orgSelect.value = firstOrgId;
               updateBookingPersons(); // mettre à jour les personnes associées
           }
       }
    } catch (err) {
        console.error('[Booking Modal] Erreur chargement organisations :', formatServerError(err.message || err));
    }
}


// -----------------------------
// Met à jour le select des personnes de l’organisation
// -----------------------------
function updateBookingPersons() {
  const orgId = parseInt(orgSelect.value);
  const org = organizations.find(o => o.id === orgId);

  if (!org) {
    console.warn('[Booking Modal] Organisation introuvable pour id:', orgId);
    populateSelect(bookingPersonSelect, [], null, {
      labelField: (p) => `${p.first_name} ${p.last_name}${p.role ? ` (${p.role})` : ''}`,
      placeholder: '-- Choisir la personne de retrait --',
      disablePlaceholder: true
    });
    return;
  }

  // ---------------------
  // 🔥 Construire la liste fusionnée
  // ---------------------
  const persons = [...(org.persons || [])];

  // Ajouter le référent si pas présent
  if (org.referent_id) {
    const alreadyInList = persons.some(p => p.id === org.referent_id);

    if (!alreadyInList) {
      persons.push({
        id: org.referent_id,
        first_name: org.referent_first_name,
        last_name: org.referent_last_name,
        phone: org.referent_phone,
        role: 'Référent'
      });
    }
  }

  // ---------------------
  // 🔥 Populate avec la liste fusionnée
  // ---------------------

  // Valeur par défaut = personId si défini, sinon référent
  const defaultPersonId = personId ?? org.referent_id;

  populateSelect(bookingPersonSelect, persons, defaultPersonId, {
    labelField: (p) => `${p.first_name} ${p.last_name}${p.role ? ` (${p.role})` : ''}`,
    placeholder: '-- Choisir la personne de retrait --',
    disablePlaceholder: true
  });
}

                       
// -----------------------------
// Validation réservation avec création automatique de booking_reference
// -----------------------------
async function handleBookingValidate() {
  try {
    const orgId = parseInt(orgSelect.value);
    const bookingPersonId = parseInt(bookingPersonSelect.value);
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!orgId || !bookingPersonId || !startDate || !endDate) {
      alert('Veuillez remplir toutes les informations obligatoires');
      return;
    }

    // Vérification disponibilité de chaque item
    for (const item of bookingItems) {
      const available = await isAvailable(client, item.id, startDate, endDate);
      if (!available) {
        alert(`L’article "${item.name}" n’est pas disponible sur cette période.`);
        return;
      }
    }

    // Création du batch
    const descriptionInput = document.getElementById('description');
    const description = descriptionInput.value.trim();
                       
    const batchRes = await createBatch(client, {
      description: document.getElementById('description').value.trim(),
      reservableIds: bookingItems.map(i => i.id)
    });
    
    let batchId;
    if (Array.isArray(batchRes)) {
      if (!batchRes.length || !batchRes[0].id) {
        throw new Error('Batch créé invalide : aucun ID reçu');
      }
      batchId = batchRes[0].id;
    } else if (batchRes && batchRes.id) {
      batchId = batchRes.id;
    } else {
      throw new Error('Batch créé invalide : aucun ID reçu');
    }

    console.log('[Booking Modal] Batch créé avec ID :', batchId);

    // Création ou récupération de la booking reference via la lib
    const bookingReference = await upsertBookingReference(client, {
      name: 'LOCATION',
      description: ''
    });
    const bookingReferenceId = bookingReference.id;

    console.log('[Booking Modal] Booking reference ID :', bookingReferenceId);

    // Détermine le pickupPerson : si "immediate checkout" coché, c'est bookingPerson
    const immediateCheckout = document.getElementById('immediate_checkout')?.checked ?? false;
    const pickupPersonId = immediateCheckout ? bookingPersonId : null;

    // Création de la réservation
    const booking = await createBooking(client, {
      p_reservable_batch_id: batchId,
      p_renter_organization_id: orgId,
      p_booking_person_id: bookingPersonId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_pickup_person_id: pickupPersonId,
      p_booking_reference_id: bookingReferenceId
    });

    console.log('[Booking Modal] Réservation créée :', booking);

    alert('Réservation créée avec succès !');
    closeBookingModal();

  } catch (err) {
    console.error('[Booking Modal] Erreur création réservation :', err);
    alert(`Erreur : ${formatServerError(err.message || err)}`);
  }
}

function updateBookingPrice() {
  if (!bookingItems || !bookingItems.length) return;
     if (!appConfig?.show_prices) {
      if (priceInput) {
        priceInput.value = '';
        priceInput.style.display = 'none';
        
        // masquer le label associé
        const label = document.querySelector(`label[for="${priceInput.id}"]`);
        if (label) label.style.display = 'none';
      }
      return;
    } else {
      if (priceInput) {
        priceInput.style.display = '';
        
        // réafficher le label
        const label = document.querySelector(`label[for="${priceInput.id}"]`);
        if (label) label.style.display = '';
      }
    }

    const start = new Date(startDateInput.value);
    const end = new Date(endDateInput.value);

    if (isNaN(start) || isNaN(end) || end <= start) {
      if (priceInput) priceInput.value = '';
      console.log('dates invalides', start, end);
      return;
    }

    const diffHours = (end - start) / (1000 * 60 * 60);
     const total = bookingItems.reduce((sum, item) => {
      const price = item.price_per_day ?? 0;
      return sum + price * (diffHours / 24); // proportion en jours
    }, 0);

    if (priceInput) priceInput.value = total.toFixed(2);

}
