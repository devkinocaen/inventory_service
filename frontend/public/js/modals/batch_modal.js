import { initClient } from '../libs/client.js';
import {
    fetchBookingById,
    fetchBatchById,
    fetchReservables,
    updateBatch,
    updateBooking,
    updateReservable
} from '../libs/sql/index.js';

import { formatServerError } from '../libs/helpers.js';
import { displayImage } from '../libs/image_utils.js';


let currentMode = 'edit'; // ← nouvelle variable globale pour le mode ('edit' ou 'viewer')

let client;
let modal, dialog, cancelBtn, saveBtn;
let currentBatch = null;
let currentBooking = null;
let availableReservables = [];
let currentModalCallback = null;

let currentPage = 1;
let pageSize = 50; // nombre d’items par page
let totalItems = 0; // récupéré depuis le RPC si possible



function formatLocalForInput(date) {
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* -------------------------------------------------------
   Chargement du HTML du modal
------------------------------------------------------- */
export async function loadBatchModal() {
    if (!document.getElementById('batch-modal')) {
        const response = await fetch(`${window.ENV.BASE_PATH}/pages/batch_modal.html`);
        if (!response.ok) throw new Error('Impossible de charger batch_modal.html');

        const html = await response.text();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
    }

    modal = document.getElementById('batch-modal');
    if (!modal) throw new Error('batch-modal introuvable après chargement');

    dialog = modal.querySelector('.batch-modal-dialog');
    if (!dialog) throw new Error('Élément .batch-modal-dialog introuvable');

    cancelBtn = dialog.querySelector('#batch-cancel');
    saveBtn   = dialog.querySelector('#batch-save');

 const batchAddSection = document.getElementById('batch-add-section');
    if (batchAddSection && currentMode === 'viewer') {
      batchAddSection.style.display = 'none';
    }
    
    bindBatchEvents();
    bindPaginationEvents();
}

/* -------------------------------------------------------
   Bind des events une seule fois
------------------------------------------------------- */
function bindBatchEvents() {
    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.dataset.bound = 'true';
        cancelBtn.addEventListener('click', () => closeBatchModal(false));
    }

    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', saveBatch);
    }
}

/* -------------------------------------------------------
   Initialisation du modal
------------------------------------------------------- */
export async function initBatchModal() {
    if (!client) client = await initClient();
    await loadBatchModal();

    await loadAvailableReservablesPage(1);
}

/* -------------------------------------------------------
   Charger la liste des réservables
------------------------------------------------------- */
async function loadAvailableReservablesPage(page = 1, searchQuery = '') {
    if (!client) client = await initClient();

    const offset = (page - 1) * pageSize;

    // Appel RPC avec pagination
    const filters = {};
    if (searchQuery) filters.p_name = searchQuery;

    filters.p_offset = offset;
    filters.p_limit = pageSize;

    const reservables = await fetchReservables(client, filters);

    availableReservables = reservables;
    renderAvailableReservables(reservables);

    currentPage = page;

    // 🔹 Mettre à jour l’affichage de la page
    const info = document.getElementById('available-pagination-info');
    info.textContent = `Page ${currentPage}`; // optionnel: tu peux rajouter totalItems si disponible

    // 🔹 Activer/désactiver les boutons
    const prevBtn = document.getElementById('available-prev-btn');
    const nextBtn = document.getElementById('available-next-btn');

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = reservables.length < pageSize; // si moins que pageSize, dernière page
}


/* -------------------------------------------------------
   Ouverture du modal
------------------------------------------------------- */
export async function openBatchModal(bookingId, onClose, mode = 'edit') {
    if (!client) client = await initClient();
    currentModalCallback = onClose;
    currentMode = mode; // ← on stocke le mode globalement

    await initBatchModal();
    
    // Récupérer le booking
    const bookingData = await fetchBookingById(client, bookingId);
    currentBooking = bookingData.booking;
    if (!currentBooking) return alert('Booking introuvable');

    currentBatch = bookingData.batch?.id
        ? await fetchBatchById(client, bookingData.batch.id)
        : { description: '', reservables: [] };

    if (!currentBatch.reservables) currentBatch.reservables = [];

    // Remplir le formulaire
    dialog.querySelector('#batch-id').value = currentBatch.id || '';
    dialog.querySelector('#batch-description').value = currentBatch.description || '';
    dialog.querySelector('#batch-start-date').value = currentBooking.start_date?.substring(0,16) || '';
    dialog.querySelector('#batch-end-date').value = currentBooking.end_date?.substring(0,16) || '';

    renderBatchItems(mode);

    // Activer / désactiver éléments selon le mode
    if (mode === 'viewer') {
        dialog.querySelector('#batch-start-date').disabled = true;
        dialog.querySelector('#batch-end-date').disabled = true;
    } else {
        dialog.querySelector('#batch-start-date').disabled = false;
        dialog.querySelector('#batch-end-date').disabled = false;
    }

    // Afficher overlay + dialogue
    modal.classList.remove('hidden');
    modal.classList.add('show');
    dialog.classList.add('show');

    // 🔹 Ajouter écouteur ESCAPE
    const escListener = (e) => {
      if (e.key === 'Escape') {
          document.removeEventListener('keydown', escListener);
          closeBatchModal(false);
      }
    };
    document.addEventListener('keydown', escListener);
    
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeBatchModal();
    }, { once: true });
}


/* -------------------------------------------------------
   Fermeture
------------------------------------------------------- */
export function closeBatchModal(withCallback = true) {
    if (!modal) return;

    dialog.classList.remove('show');
    modal.classList.remove('show');

    setTimeout(() => {
        modal.classList.add('hidden');
        currentBatch = null;
        currentBooking = null;

        if (currentModalCallback && withCallback) {
            currentModalCallback();
            currentModalCallback = null;
        }
    }, 250);
}


/* -------------------------------------------------------
   Rendu tableau des items
------------------------------------------------------- */
function renderBatchItems() {
    const tbody = dialog.querySelector('#batch-tbody');
    tbody.innerHTML = '';

    if (!currentBatch.reservables.length) return;

    currentBatch.reservables.forEach(item => {
                                     
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = item.name;
                                     
         const previewTd = document.createElement('td');

         const imgContainer = document.createElement('div');
         imgContainer.style.width = '60px';
         imgContainer.style.height = '60px';
         imgContainer.style.flex = '0 0 auto'; // pour éviter qu'il rétrécisse
         imgContainer.style.overflow = 'hidden';
         imgContainer.style.borderRadius = '4px';
         imgContainer.style.backgroundColor = '#eee';


         // mettre une image par défaut immédiatement
         const placeholder = document.createElement('img');
         placeholder.src = 'https://placehold.co/60x60?text=+';
         placeholder.style.width = '100%';
         placeholder.style.height = '100%';
         placeholder.style.objectFit = 'cover';
         imgContainer.appendChild(placeholder);

         previewTd.appendChild(imgContainer);
            
         const firstPhoto = Array.isArray(item.photos) && item.photos.length > 0 ? item.photos[0] : null;

         if (firstPhoto?.url) {
             displayImage(client, imgContainer, firstPhoto.url, {
                 width: '60px',
                 height: '60px',
                 withPreview: true
             });
         } else {
             imgContainer.innerHTML = `
                 <img
                   src="https://placehold.co/60x60?text=+"
                   style="width:100%;height:100%;object-fit:cover"
                 >
             `;
         }
                                     
        const sizeTd = document.createElement('td');
        sizeTd.textContent = item.size || '-';

        const actionTd = document.createElement('td');
        const actionBtn = document.createElement('button');
        actionBtn.classList.add('batch-item-action');

        if (currentMode === 'viewer') {
            actionBtn.textContent = item.is_in_stock ? 'Sortir' : 'Rentrer';
            actionBtn.disabled = true;
        } else {
            if (item.is_in_stock === false) {
                actionBtn.textContent = 'Rentrer';
                actionBtn.disabled = false;
                actionBtn.classList.add('rentrer');
            } else if (item.is_in_stock === true && item.status === 'disponible') {
                actionBtn.textContent = 'Sortir';
                actionBtn.disabled = false;
                actionBtn.classList.add('sortir');
            } else {
                actionBtn.textContent = 'Indisponible';
                actionBtn.disabled = true;
                actionBtn.classList.add('indisponible');
            }

            actionBtn.addEventListener('click', async () => {
                if (actionBtn.disabled) return;
                const isCurrentlyRentrer = actionBtn.textContent === 'Rentrer';
                item.is_in_stock = isCurrentlyRentrer;

                if (item.is_in_stock) {
                    actionBtn.textContent = 'Sortir';
                    actionBtn.classList.remove('rentrer');
                    actionBtn.classList.add('sortir');
                } else {
                    actionBtn.textContent = 'Rentrer';
                    actionBtn.classList.remove('sortir');
                    actionBtn.classList.add('rentrer');
                }

                await updateReservable(client, { id: item.id, is_in_stock: item.is_in_stock });
            });
        }

        actionTd.appendChild(actionBtn);

        const deleteTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '❌';
        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            currentBatch.reservables = currentBatch.reservables.filter(i => i.id !== item.id);
            renderBatchItems(); // utilise currentMode
        });
        deleteTd.appendChild(deleteBtn);

        tr.appendChild(nameTd);
        tr.appendChild(previewTd);
        tr.appendChild(sizeTd);
        tr.appendChild(actionTd);
        tr.appendChild(deleteTd);

        tbody.appendChild(tr);
    });

    const descInput = dialog.querySelector('#batch-description');
    if (descInput) descInput.disabled = false; // renommage toujours possible
}


function bindPaginationEvents() {
    const prevBtn = dialog.querySelector('#available-prev-btn');
    const nextBtn = dialog.querySelector('#available-next-btn');
    const searchInput = dialog.querySelector('#available-search');

    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = 'true';
        prevBtn.addEventListener('click', () => {
            loadAvailableReservablesPage(currentPage - 1, searchInput.value.trim());
        });
    }

    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = 'true';
        nextBtn.addEventListener('click', () => {
            loadAvailableReservablesPage(currentPage + 1, searchInput.value.trim());
        });
    }

    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', () => {
            loadAvailableReservablesPage(1, searchInput.value.trim());
        });
    }
}


/* -------------------------------------------------------
   Sauvegarde
------------------------------------------------------- */
async function saveBatch(e) {
    e.preventDefault();
    if (!currentBatch) return;

    const description = dialog.querySelector('#batch-description').value.trim();

    // Validation des dates
    const dates = validateBatchDates();
    if (!dates) return; // dates invalides, on stoppe

    try {
        const savedBatch = await updateBatch(client, {
            id: currentBatch.id,
            description,
            reservables: currentBatch.reservables
        });
        
        const savedBooking = await updateBooking(client, {
            id: currentBooking.id,
            start_date: formatLocalForInput(dates.startDate),
            end_date: formatLocalForInput(dates.endDate),
        });

        
        console.log('Batch enregistré', savedBatch);
        closeBatchModal();

    } catch (err) {
        console.error('[updateBatch]', err);
        alert(`❌ Impossible d’enregistrer :\n\n${formatServerError(err.message)}`);
    }
}



function validateBatchDates() {
    const startInput = dialog.querySelector('#batch-start-date');
    const endInput   = dialog.querySelector('#batch-end-date');

    if (!startInput || !endInput) return false;

    const startDate = new Date(startInput.value);
    const endDate   = new Date(endInput.value);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        alert('Dates invalides');
        return false;
    }

    if (endDate < startDate) {
        alert('La date de fin doit être après la date de début');
        return false;
    }

    return { startDate, endDate };
}


function renderAvailableReservables(reservables) {
    const container = document.getElementById('available-reservables');
    container.innerHTML = '';

    reservables.forEach(r => {
        const div = document.createElement('div');
        div.classList.add('reservable-item');
        div.dataset.id = r.id;
        div.style.cursor = 'pointer';
        div.style.display = 'inline-block';
        div.style.margin = '4px';
        div.style.textAlign = 'center';
        div.style.width = '80px';

        // Container pour l'image
        const imgContainer = document.createElement('div');
        imgContainer.style.width = '80px';
        imgContainer.style.height = '80px';
        imgContainer.style.borderRadius = '4px';
        imgContainer.style.overflow = 'hidden';
        imgContainer.style.backgroundColor = '#eee';
        div.appendChild(imgContainer);

        // Affichage de l'image via displayImage ou placeholder
        const firstPhoto = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null;
        if (firstPhoto?.url) {
            displayImage(client, imgContainer, firstPhoto.url, {
                width: '80px',
                height: '80px',
                withPreview: true
            });
        } else {
            imgContainer.innerHTML = `
                <img
                  src="https://placehold.co/80x80?text=+"
                  style="width:100%;height:100%;object-fit:cover"
                >
            `;
        }

        // Nom en dessous
        const name = document.createElement('div');
        name.textContent = r.name;
        name.style.marginTop = '4px';
        name.style.fontSize = '0.9rem';
        div.appendChild(name);

        // clic pour sélectionner / ajouter
        div.addEventListener('click', () => {
            if (currentMode === 'edit') {
                // toggle visuel sélectionné
                div.classList.toggle('selected');

                const id = Number(div.dataset.id);
                const reservable = availableReservables.find(r => r.id === id);
                if (!reservable) return;

                if (!currentBatch.reservables.some(i => i.id === id)) {
                    currentBatch.reservables.push(reservable);
                    renderBatchItems();
                }
            }
        });

        container.appendChild(div);
    });
}
