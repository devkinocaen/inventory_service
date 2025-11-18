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
// Charger modal HTML et l'ajouter au body
// -----------------------------
export async function loadBatchModal() {
    // Vérifie si le modal existe déjà dans le DOM
    
    modal = document.getElementById('batch-modal');
    console.log ("modal1", modal)
    if (!modal) {
        const response = await fetch(`${window.ENV.BASE_PATH}/pages/batch_modal.html`);
        if (!response.ok) throw new Error('Impossible de charger le modal batch');
        const html = await response.text();
        
        // Crée un conteneur temporaire
        const div = document.createElement('div');
        div.innerHTML = html.trim();
        console.log ("div", div)

        // Récupère le modal dans ce conteneur
        modal = div.querySelector('#batch-modal');
        if (!modal) throw new Error('Le modal batch est introuvable dans le HTML chargé');

        // Ajoute directement dans le body
        document.body.appendChild(modal);
      //  ensureModalInBody(modal);
        console.log ("modal2", modal)
    }
    console.log ("modal3", modal)

    // Sélection des éléments internes
    dialog = modal.querySelector('.batch-modal-content');
    if (!dialog) throw new Error('Le dialogue est introuvable dans le HTML chargé');
    
    cancelBtn = modal.querySelector('#batch-cancel');
    saveBtn = modal.querySelector('#batch-save');
    addBtn = modal.querySelector('#add-reservable');

    // Ajout des listeners si nécessaire
    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.addEventListener('click', closeBatchModal);
        cancelBtn.dataset.bound = 'true';
    }
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.addEventListener('click', saveBatch);
        saveBtn.dataset.bound = 'true';
    }
    if (addBtn && !addBtn.dataset.bound) {
        addBtn.addEventListener('click', addSelectedReservable);
        addBtn.dataset.bound = 'true';
    }
}

// Déplacer le modal à la fin du body pour éviter tout parent avec transform/filter
function ensureModalInBody(modalEl) {
    if (!modalEl) return;
    if (modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
        console.log('Modal déplacé directement sous <body>');
    }
}



// -----------------------------
// Initialisation modal
// -----------------------------
export async function initBatchModal() {
    if (!client) client = await initClient();
    await loadBatchModal();

    await loadAvailableReservables();
    console.log ("modal5", modal)

    setupAvailableSearch();
}

// -----------------------------
// Charger les réservables disponibles
// -----------------------------
async function loadAvailableReservables() {
    if (!dialog) throw new Error('Dialog non initialisé avant chargement des réservables');
    availableReservables = await fetchReservables(client);
    const select = dialog.querySelector('#available-reservables');
    populateSelect(select, availableReservables, 'id', 'name', 'Sélectionnez un item');
}

// -----------------------------
// Filtrage dynamique du select
// -----------------------------
function setupAvailableSearch() {
    if (!dialog) return;
    const searchInput = dialog.querySelector('#available-search');
    const select = dialog.querySelector('#available-reservables');
    if (!searchInput || !select) return;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        select.innerHTML = '';
        availableReservables
            .filter(r => r.name.toLowerCase().includes(query))
            .forEach(r => {
                const option = document.createElement('option');
                option.value = r.id;
                option.textContent = r.name;
                select.appendChild(option);
            });
    });
}

// -----------------------------
// Ouvrir modal batch
// -----------------------------
export async function openBatchModal(bookingId) {
    if (!client) client = await initClient();
    currentBooking = await fetchBookingById(client, bookingId);
    if (!currentBooking) return alert('Booking introuvable');

    currentBatch = currentBooking.batch_id
        ? await fetchBatchById(client, currentBooking.batch_id)
        : { description: '', items: [] };
    if (!currentBatch.items) currentBatch.items = [];

    await initBatchModal();
    dialog.querySelector('#batch-id').value = currentBatch.id || '';
    dialog.querySelector('#batch-description').value = currentBatch.description || '';
    dialog.querySelector('#batch-start-date').value = currentBooking.start_date?.substring(0,16) || '';
    dialog.querySelector('#batch-end-date').value = currentBooking.end_date?.substring(0,16) || '';

    renderBatchItems();
    modal.classList.add('show');
    modal.classList.remove('hidden');
    console.log ('modal', modal)
}

// -----------------------------
// Fermer modal
// -----------------------------
export function closeBatchModal() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.classList.add('hidden');
    currentBatch = null;
    currentBooking = null;
}

// -----------------------------
// Rendu des items du batch
// -----------------------------
function renderBatchItems() {
    if (!dialog) return;
    const tbody = dialog.querySelector('#batch-tbody');
    tbody.innerHTML = '';
    if (!currentBatch?.items?.length) return;

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

// -----------------------------
// Ajouter item depuis disponible
// -----------------------------
function addSelectedReservable() {
    if (!dialog) return;
    const select = dialog.querySelector('#available-reservables');
    const selectedId = Number(select.value);
    if (!selectedId) return;

    const selectedItem = availableReservables.find(r => r.id === selectedId);
    if (!selectedItem) return;

    if (!currentBatch.items) currentBatch.items = [];
    if (!currentBatch.items.some(i => i.id === selectedItem.id)) {
        currentBatch.items.push({
            ...selectedItem,
            status: selectedItem.status || 'réservé',
            checkin: null,
            checkout: null
        });
        renderBatchItems();
    }
}

// -----------------------------
// Sauvegarder le batch
// -----------------------------
async function saveBatch(e) {
    e.preventDefault();
    if (!currentBatch) return;

    const description = dialog.querySelector('#batch-description').value.trim();
    const reservableIds = (currentBatch.items || []).map(i => i.id);

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
