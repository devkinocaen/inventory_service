import { initClient } from '../libs/client.js';
import {
    fetchBookingById,
    fetchBatchById,
    fetchReservables,
    updateBatch
} from '../libs/sql/index.js';
import { populateSelect } from '../libs/ui/populateSelect.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let modal, dialog, cancelBtn, saveBtn, addBtn;
let currentBatch = null;
let currentBooking = null;
let availableReservables = [];

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
export async function openBatchModal(bookingId) {
    if (!client) client = await initClient();
    await initBatchModal();

    // Récupérer le booking
    currentBooking = await fetchBookingById(client, bookingId);
    if (!currentBooking) return alert('Booking introuvable');

    currentBatch = currentBooking.batch_id
        ? await fetchBatchById(client, currentBooking.batch_id)
        : { description: '', items: [] };

    if (!currentBatch.items) currentBatch.items = [];

    // Remplir le formulaire
    dialog.querySelector('#batch-id').value = currentBatch.id || '';
    dialog.querySelector('#batch-description').value = currentBatch.description || '';
    dialog.querySelector('#batch-start-date').value = currentBooking.start_date?.substring(0,16) || '';
    dialog.querySelector('#batch-end-date').value = currentBooking.end_date?.substring(0,16) || '';

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

    // retirer l'animation
    dialog.classList.remove('show');
    modal.classList.remove('show');

    // cacher après transition
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);

    currentBatch = null;
    currentBooking = null;
}


/* -------------------------------------------------------
   Rendu tableau des items
------------------------------------------------------- */
function renderBatchItems() {
    const tbody = dialog.querySelector('#batch-tbody');
    tbody.innerHTML = '';

    if (!currentBatch.items.length) return;

    currentBatch.items.forEach(item => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.status || 'réservé'}</td>
            <td>${item.checkin || '-'} → ${item.checkout || '-'}</td>
            <td><button type="button" data-id="${item.id}">❌</button></td>
        `;

        tr.querySelector('button').addEventListener('click', e => {
            e.stopPropagation();
            currentBatch.items = currentBatch.items.filter(i => i.id !== item.id);
            renderBatchItems();
        });

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

    const item = availableReservables.find(r => r.id === id);
    if (!item) return;

    if (!currentBatch.items.some(i => i.id === id)) {
        currentBatch.items.push({
            ...item,
            status: item.status || 'réservé',
            checkin: null,
            checkout: null
        });
        renderBatchItems();
    }
}

/* -------------------------------------------------------
   Sauvegarde
------------------------------------------------------- */
async function saveBatch(e) {
    e.preventDefault();
    if (!currentBatch) return;

    const description = dialog.querySelector('#batch-description').value.trim();
    const reservableIds = currentBatch.items.map(i => i.id);

    try {
        const saved = await updateBatch(client, {
            id: currentBatch.id,
            description,
            reservables: reservableIds
        });

        console.log('Batch enregistré', saved);
        alert('✅ Batch enregistré avec succès.');
        closeBatchModal();

    } catch (err) {
        console.error('[updateBatch]', err);
        alert(`❌ Impossible d’enregistrer :\n\n${formatServerError(err)}`);
    }
}
