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

// -----------------------------
// Initialisation modal
// -----------------------------
export async function initBatchModal() {
    await loadBatchModal();
    await loadAvailableReservables();
}

// -----------------------------
// Charger le modal HTML
// -----------------------------
export async function loadBatchModal() {
    modal = document.getElementById('batch-modal');
    if (!modal) return;

    dialog = modal.querySelector('.batch-modal-content');
    cancelBtn = dialog.querySelector('#batch-cancel');
    saveBtn = dialog.querySelector('#batch-save');
    addBtn = dialog.querySelector('#add-reservable');

    cancelBtn?.addEventListener('click', closeBatchModal);
    saveBtn?.addEventListener('click', saveBatch);
    addBtn?.addEventListener('click', addSelectedReservable);
}

// -----------------------------
// Chargement des réservables disponibles
// -----------------------------
async function loadAvailableReservables() {
    availableReservables = await fetchReservables(client);
    const select = dialog.querySelector('#available-reservables');
    populateSelect(select, availableReservables, 'id', 'name', 'Sélectionnez un item');
}

// -----------------------------
// Ouvrir modal avec booking
// -----------------------------
export async function openBatchModal(bookingId) {
    client = await initClient();
    currentBooking = await fetchBookingById(client, bookingId);
    if (!currentBooking) return alert('Booking introuvable');

    // Récupérer le batch associé
    currentBatch = currentBooking.batch_id ? await fetchBatchById(client, currentBooking.batch_id) : null;

    await initBatchModal();

    // Remplir champs batch
    if (currentBatch) {
        dialog.querySelector('#batch-id').value = currentBatch.id;
        dialog.querySelector('#batch-description').value = currentBatch.description || '';
        dialog.querySelector('#batch-start-date').value = currentBatch.start_date ? currentBatch.start_date.substring(0,16) : '';
        dialog.querySelector('#batch-end-date').value = currentBatch.end_date ? currentBatch.end_date.substring(0,16) : '';
    } else {
        dialog.querySelectorAll('input').forEach(el => el.value = '');
    }

    // Remplir tableau des items
    renderBatchItems();

    modal.classList.remove('hidden');
    void dialog.offsetWidth;
    dialog.classList.add('show');
}

// -----------------------------
// Fermer modal
// -----------------------------
export function closeBatchModal() {
    if (!modal || !dialog) return;
    dialog.classList.remove('show');
    modal.classList.add('hidden');
    currentBatch = null;
    currentBooking = null;
}

// -----------------------------
// Rendu des items du batch
// -----------------------------
function renderBatchItems() {
    const tbody = dialog.querySelector('#batch-tbody');
    tbody.innerHTML = '';
    if (!currentBatch?.items?.length) return;

    currentBatch.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.status}</td>
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

// -----------------------------
// Ajouter un item depuis la liste disponible
// -----------------------------
function addSelectedReservable() {
    const select = dialog.querySelector('#available-reservables');
    const selectedId = Number(select.value);
    if (!selectedId) return;

    const selectedItem = availableReservables.find(r => r.id === selectedId);
    if (!selectedItem) return;

    if (!currentBatch.items) currentBatch.items = [];
    if (!currentBatch.items.some(i => i.id === selectedItem.id)) {
        currentBatch.items.push({ ...selectedItem, status: 'réservé', checkin: null, checkout: null });
        renderBatchItems();
    }
}

// -----------------------------
// Sauvegarder le batch
// -----------------------------
async function saveBatch(e) {
    e.preventDefault();
    if (!currentBatch) return;

    currentBatch.description = dialog.querySelector('#batch-description').value.trim();
    currentBatch.start_date = dialog.querySelector('#batch-start-date').value;
    currentBatch.end_date = dialog.querySelector('#batch-end-date').value;

    try {
        const saved = await updateBatch(client, currentBatch);
        console.log('Batch enregistré', saved);
        alert('✅ Batch enregistré avec succès.');
        closeBatchModal();
    } catch (err) {
        console.error('[updateBatch]', err);
        alert(`❌ Impossible d’enregistrer :\n\n${formatServerError(err)}`);
    }
}
