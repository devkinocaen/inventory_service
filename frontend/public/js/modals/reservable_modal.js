import { initClient } from '../libs/client.js';
import {
    fetchReservableById,
    updateReservable,
    createReservable,
    fetchCategories,
    fetchSubcategoriesByCategory,
    fetchStyles,
    fetchOrganizations,
    fetchStorageLocations,
    fetchAppConfig
} from '../libs/sql/index.js';
import { populateSelect } from '../libs/ui/populateSelect.js';
import { formatServerError } from '../libs/helpers.js';

let client = null;
let appConfig = null;

let modal, dialog, cancelBtn, saveBtn;
let currentReservable = null;
let allStyles = [];
let categories = [];
let subCategories = {}; // { categoryId: [subcat,...] }
let organizations = [];
let storageLocations = [];
let onSaveCallback = null; // callback à appeler après sauvegarde

// -----------------------------
// Initialisation modal
// -----------------------------
export async function initReservableModal() {
    await loadReservableModal();
    await loadCategorySelects();
    await loadStyles();
    await loadOrganizationsSelects();
    await loadStorageSelect();
}

// -----------------------------
// Charger le modal HTML
// -----------------------------
export async function loadReservableModal() {
    if (!document.getElementById('rsb-modal-reservable')) {
        const response = await fetch(`${window.ENV.BASE_PATH}/pages/reservable_modal.html`);
        if (!response.ok) throw new Error('Impossible de charger le modal reservable');
        const div = document.createElement('div');
        div.innerHTML = await response.text();
        document.body.appendChild(div);
    }

    modal = document.getElementById('rsb-modal-reservable');
    if (!modal) return;

    dialog = modal.querySelector('.rsb-modal-content');
    cancelBtn = dialog.querySelector('#rsb-res-cancel');
    saveBtn = dialog.querySelector('#rsb-res-save');

    cancelBtn?.addEventListener('click', closeReservableModal);
    saveBtn?.addEventListener('click', saveReservable);
}

// -----------------------------
// Catégories & sous-catégories
// -----------------------------
async function loadCategorySelects() {
    categories = await fetchCategories(client);
    const categorySelect = dialog.querySelector('#rsb-res-category');
    const subCategorySelect = dialog.querySelector('#rsb-res-subcategory');

    populateSelect(categorySelect, categories, 'id', 'name', 'Sélectionnez une catégorie');

    categorySelect.addEventListener('change', async () => {
        const selectedId = Number(categorySelect.value) || null;
        await loadSubCategories(selectedId);
        populateSelect(subCategorySelect, subCategories[selectedId] || [], 'id', 'name', 'Sélectionnez une sous-catégorie');
        subCategorySelect.value = '';
    });

    if (currentReservable?.category_id) {
        categorySelect.value = currentReservable.category_id;
        await loadSubCategories(currentReservable.category_id);
        populateSelect(subCategorySelect, subCategories[currentReservable.category_id] || [], 'id', 'name', 'Sélectionnez une sous-catégorie');
        subCategorySelect.value = currentReservable.subcategory_id || '';
    }
}

async function loadSubCategories(categoryId) {
    if (!categoryId) return;
    subCategories[categoryId] = await fetchSubcategoriesByCategory(client, categoryId);
}

// -----------------------------
// Styles
// -----------------------------
async function loadStyles() {
    allStyles = await fetchStyles(client);
    const styleSelect = dialog.querySelector('#rsb-res-add-style');
    populateSelect(styleSelect, allStyles, 'id', 'name', 'Ajouter un style');

    styleSelect.addEventListener('change', () => {
        const selectedId = Number(styleSelect.value);
        if (!selectedId) return;
        const selectedStyle = allStyles.find(s => s.id === selectedId);
        if (selectedStyle) addStyleChip(selectedStyle);
        styleSelect.value = '';
    });

    renderStyleChips();
}

function renderStyleChips() {
    const container = dialog.querySelector('#rsb-chips-style');
    container.innerHTML = '';

    if (!currentReservable?.style_ids?.length) return;
    currentReservable.style_ids.forEach(id => {
        const style = allStyles.find(s => s.id === id);
        if (style) addStyleChip(style);
    });
}

function addStyleChip(style) {
    const container = dialog.querySelector('#rsb-chips-style');
    if (Array.from(container.children).some(c => c.dataset.id == style.id)) return;

    const chip = document.createElement('div');
    chip.className = 'rsb-chip';
    chip.dataset.id = style.id;
    chip.innerHTML = `${style.name} <button type="button">✕</button>`;
    chip.querySelector('button').addEventListener('click', e => {
        e.stopPropagation();
        chip.remove();
    });

    container.appendChild(chip);
}

// -----------------------------
// Organisations (owner & manager)
// -----------------------------
async function loadOrganizationsSelects() {
    organizations = await fetchOrganizations(client);
    const ownerSelect = dialog.querySelector('#rsb-res-owner');
    const managerSelect = dialog.querySelector('#rsb-res-manager');

    populateSelect(ownerSelect, organizations, 'id', 'name', 'Sélectionnez un propriétaire');
    populateSelect(managerSelect, organizations, 'id', 'name', 'Sélectionnez un gestionnaire');

    if (currentReservable) {
        ownerSelect.value = currentReservable.owner_id || '';
        managerSelect.value = currentReservable.manager_id || '';
    }
}

// -----------------------------
// Storage locations
// -----------------------------
async function loadStorageSelect() {
    storageLocations = await fetchStorageLocations(client);
    const storageSelect = dialog.querySelector('#rsb-res-storage');

    populateSelect(storageSelect, storageLocations, 'id', 'name', 'Sélectionnez un stockage');
    if (currentReservable) {
        storageSelect.value = currentReservable.storage_location_id || '';
    }
}

// -----------------------------
// Ouvrir / fermer modal
// -----------------------------
export async function openReservableModal(reservableId, onSave = null) {
    client = await initClient();
    // 🔥 Charger la config
    const res = await fetchAppConfig(client);
    appConfig = res || {}; // sécurité
    
    onSaveCallback = onSave;
     let fetchedReservable = null;

    if (reservableId != null) {
        try {
            fetchedReservable = await fetchReservableById(client, reservableId);
        } catch {
            console.warn(`[openReservableModal] Aucun reservable trouvé pour ID ${reservableId}, création d'un nouvel item.`);
        }
    }
    currentReservable = fetchedReservable || { id: null, inventory_type: 'costume' };

    await initReservableModal();
    if (!modal || !dialog) return;

    const getEl = id => dialog.querySelector(id);

    if (currentReservable.id != null) {
        document.getElementById('rsb-title').textContent = 'Editer un item';

        const fields = {
            '#rsb-res-name': currentReservable.name,
            '#rsb-res-size': currentReservable.size,
            '#rsb-res-price': currentReservable.price_per_day,
            '#rsb-res-description': currentReservable.description,
            '#rsb-res-status': currentReservable.status || 'disponible',
            '#rsb-res-quality': currentReservable.quality || 'neuf',
            '#rsb-res-category': currentReservable.category_id,
            '#rsb-res-subcategory': currentReservable.subcategory_id,
            '#rsb-res-owner': currentReservable.owner_id,
            '#rsb-res-manager': currentReservable.manager_id,
            '#rsb-res-storage': currentReservable.storage_location_id
        };

        Object.entries(fields).forEach(([sel, val]) => {
            const el = getEl(sel);
            if (el) el.value = val ?? '';
        });

        dialog.querySelectorAll('input[name="rsb-res-gender"]').forEach(r => r.checked = r.value === currentReservable.gender);
        dialog.querySelectorAll('input[name="rsb-res-privacy"]').forEach(r => r.checked = r.value === currentReservable.privacy);
    } else {
        document.getElementById('rsb-title').textContent = 'Créer un nouvel item';

        dialog.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.type === 'radio') el.checked = false;
            else el.value = '';
        });
        dialog.querySelector('#rsb-res-status').value = 'disponible';
        dialog.querySelector('#rsb-res-quality').value = 'neuf';
        dialog.querySelector('input[name="rsb-res-gender"][value="unisex"]').checked = true;
        dialog.querySelector('input[name="rsb-res-privacy"][value="public"]').checked = true;
        
        
        // ================================
        // Injecter les valeurs par défaut
        // ================================
        if (appConfig) {
            if (appConfig.default_owner_id) {
                dialog.querySelector('#rsb-res-owner').value = appConfig.default_owner_id;
            }
            if (appConfig.default_manager_id) {
                dialog.querySelector('#rsb-res-manager').value = appConfig.default_manager_id;
            }
            if (appConfig.default_storage_location_id) {
                dialog.querySelector('#rsb-res-storage').value = appConfig.default_storage_location_id;
            }
        }
    }

    renderStyleChips();
    modal.classList.remove('hidden');
    void dialog.offsetWidth;
    dialog.classList.add('show');
}

export function closeReservableModal() {
    if (!modal || !dialog) return;
    dialog.classList.remove('show');
    modal.classList.add('hidden');
    currentReservable = null;
    onSaveCallback = null;
}

// -----------------------------
// Sauvegarder
// -----------------------------
async function saveReservable(e) {
    e.preventDefault();
    const getEl = id => dialog.querySelector(id);
    const name = getEl('#rsb-res-name').value.trim();
    if (!name) {
        alert('Le nom est obligatoire.');
        return;
    }

    const gender = dialog.querySelector('input[name="rsb-res-gender"]:checked')?.value;
    const privacy = dialog.querySelector('input[name="rsb-res-privacy"]:checked')?.value;
    const style_ids = Array.from(dialog.querySelectorAll('#rsb-chips-style .rsb-chip')).map(c => Number(c.dataset.id));

    const data = {
        id: currentReservable?.id || null,
        name,
        inventory_type: 'costume',
        type: getEl('#rsb-res-type')?.value || null,
        size: getEl('#rsb-res-size').value,
        price_per_day: parseFloat(getEl('#rsb-res-price').value),
        description: getEl('#rsb-res-description').value,
        status: getEl('#rsb-res-status').value || 'disponible',
        quality: getEl('#rsb-res-quality').value || 'bon état',
        category_id: getEl('#rsb-res-category').value || null,
        subcategory_id: getEl('#rsb-res-subcategory').value || null,
        owner_id: getEl('#rsb-res-owner').value || null,
        manager_id: getEl('#rsb-res-manager').value || null,
        storage_location_id: getEl('#rsb-res-storage').value || null,
        gender,
        privacy,
        style_ids
    };

    try {
        let saved, savedId;
        if (currentReservable?.id) {
            await updateReservable(client, data);
            saved = await fetchReservableById(client, data.id);
        } else {
            savedId = await createReservable(client, data);
            saved = await fetchReservableById(client, savedId);
        }

        alert('✅ Reservable enregistré avec succès.');
        console.log('Reservable enregistré', saved);
        
        if (typeof onSaveCallback === 'function') {
            onSaveCallback(saved);
        }
        closeReservableModal();

    } catch (err) {
        console.error('[saveReservable]', err);
        alert(`❌ Impossible d’enregistrer : ${formatServerError(err)}`);
    }
}
