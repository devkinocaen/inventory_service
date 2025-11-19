import { initClient } from '../libs/client.js';
import {
    fetchBookingById,
    fetchBatchById,
    fetchReservables,
    updateBatch,
    updateReservable
} from '../libs/sql/index.js';
import { populateSelect } from '../libs/ui/populateSelect.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let modal, dialog, cancelBtn, saveBtn, addBtn;
let currentBatch = null;
let currentBooking = null;
let availableReservables = [];
let currentModalCallback = null;
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
    addBtn    = dialog.querySelector('#add-reservable');

    bindBatchEvents();
}

/* -------------------------------------------------------
   Bind des events une seule fois
------------------------------------------------------- */
function bindBatchEvents() {
    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.dataset.bound = 'true';
        cancelBtn.addEventListener('click', closeBatchModal);
    }

    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', saveBatch);
    }

    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = 'true';
        addBtn.addEventListener('click', addSelectedReservable);
    }
}

/* -------------------------------------------------------
   Initialisation du modal
------------------------------------------------------- */
export async function initBatchModal() {
    if (!client) client = await initClient();
    await loadBatchModal();

    await loadAvailableReservables();
    setupAvailableSearch();
}

/* -------------------------------------------------------
   Charger la liste des réservables
------------------------------------------------------- */
async function loadAvailableReservables() {
    availableReservables = await fetchReservables(client);

    const select = dialog.querySelector('#available-reservables');
    if (!select) throw new Error('Select #available-reservables introuvable');

    populateSelect(select, availableReservables, 'id', 'name', 'Sélectionnez un item');
}

/* -------------------------------------------------------
   Filtre dynamique du select
------------------------------------------------------- */
function setupAvailableSearch() {
    const search = dialog.querySelector('#available-search');
    const select = dialog.querySelector('#available-reservables');
    if (!search || !select) return;

    search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        select.innerHTML = '';

        availableReservables
            .filter(r => r.name.toLowerCase().includes(q))
            .forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                select.appendChild(opt);
            });
    });
}

/* -------------------------------------------------------
   Ouverture du modal
------------------------------------------------------- */
export async function openBatchModal(bookingId, onClose) {
    if (!client) client = await initClient();
    currentModalCallback = onClose;

    await initBatchModal();
    
    // Récupérer le booking
    const bookingData = await fetchBookingById(client, bookingId);
    currentBooking=bookingData.booking
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

    console.log ('currentBooking.start_date?.substring(0,16)', currentBooking.start_date?.substring(0,16))
    
    renderBatchItems();

    // Afficher overlay + dialogue avec animation
    modal.classList.remove('hidden');
    modal.classList.add('show');
    dialog.classList.add('show'); // <-- important pour scale/opacity

    // Permettre de fermer en cliquant sur l'overlay (hors dialogue)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeBatchModal();
    }, { once: true });
}

/* -------------------------------------------------------
   Fermeture
------------------------------------------------------- */
export function closeBatchModal() {
    if (!modal) return;

    dialog.classList.remove('show');
    modal.classList.remove('show');

    setTimeout(() => {
        modal.classList.add('hidden');
        currentBatch = null;
        currentBooking = null;

        if (currentModalCallback) {
            currentModalCallback(); // <-- appel du callback
            currentModalCallback = null; // on le réinitialise
        }
    }, 250);
}


/* -------------------------------------------------------
   Rendu tableau des items
------------------------------------------------------- */
function renderBatchItems(onClose) {
    const tbody = dialog.querySelector('#batch-tbody');
    tbody.innerHTML = '';

    if (!currentBatch.reservables.length) return;

    currentBatch.reservables.forEach(item => {
        const tr = document.createElement('tr');

        // Nom + taille
        const nameTd = document.createElement('td');
        nameTd.textContent = item.name;

        const sizeTd = document.createElement('td');
        sizeTd.textContent = item.size || '-';

        // Colonne action dynamique
        const actionTd = document.createElement('td');
        const actionBtn = document.createElement('button');
        actionBtn.classList.add('batch-item-action');

        // Déterminer l'état initial et la classe CSS
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

        // Listener pour basculer l'état
        actionBtn.addEventListener('click', async () => {
            if (actionBtn.disabled) return;

            // Toggle is_in_stock
            const isCurrentlyRentrer = actionBtn.textContent === 'Rentrer';
            item.is_in_stock = isCurrentlyRentrer;

            // Mettre à jour le texte et la classe CSS
            if (item.is_in_stock) {
                actionBtn.textContent = 'Sortir';
                actionBtn.classList.remove('rentrer');
                actionBtn.classList.add('sortir');
            } else {
                actionBtn.textContent = 'Rentrer';
                actionBtn.classList.remove('sortir');
                actionBtn.classList.add('rentrer');
            }

            // Ici tu peux appeler la fonction backend pour sauvegarder
            await updateReservable(client, { id: item.id, is_in_stock: item.is_in_stock });
        });

        actionTd.appendChild(actionBtn);

        // Colonne supprimer
        const deleteTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '❌';
        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            currentBatch.reservables = currentBatch.reservables.filter(i => i.id !== item.id);
            renderBatchItems();
        });
        deleteTd.appendChild(deleteBtn);

        // Assemblage de la ligne
        tr.appendChild(nameTd);
        tr.appendChild(sizeTd);
        tr.appendChild(actionTd);
        tr.appendChild(deleteTd);

        tbody.appendChild(tr);
    });
}


/* -------------------------------------------------------
   Ajouter un item depuis le select
------------------------------------------------------- */
function addSelectedReservable() {
    const select = dialog.querySelector('#available-reservables');
    const id = Number(select.value);
    if (!id) return;

    const reservable = availableReservables.find(r => r.id === id);
    if (!reservable) return;

    if (!currentBatch.reservables.some(i => i.id === id)) {
        currentBatch.reservables.push(reservable);
        renderBatchItems();
        
        console.log ('currentBatch apres addSelectedReservable', currentBatch)
    }
}

/* -------------------------------------------------------
   Sauvegarde
------------------------------------------------------- */
async function saveBatch(e) {
    e.preventDefault();
    if (!currentBatch) return;

    const description = dialog.querySelector('#batch-description').value.trim();

    try {
        const saved = await updateBatch(client, {
            id: currentBatch.id,
            description,
            reservables: currentBatch.reservables
        });

        console.log('Batch enregistré', saved);
       // alert('✅ Batch enregistré avec succès.');
        closeBatchModal();

    } catch (err) {
        console.error('[updateBatch]', err);
        alert(`❌ Impossible d’enregistrer :\n\n${formatServerError(err)}`);
    }
}
