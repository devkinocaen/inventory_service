import { initClient } from '../libs/client.js';
import {
    fetchReservableById,
    fetchColors,
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
let allColors = [];

// -----------------------------
// Initialisation modal
// -----------------------------
// -----------------------------
// Initialisation modal refactorée
// -----------------------------
export async function initReservableModal() {
    // 🔹 Charger le HTML du modal
    await loadReservableModal();

    if (!dialog) return;

    // 🔹 Charger toutes les données en parallèle
    const [
        fetchedCategories,
        fetchedStyles,
        fetchedOrganizations,
        fetchedStorageLocations,
        fetchedColors
    ] = await Promise.all([
        fetchCategories(client),
        fetchStyles(client),
        fetchOrganizations(client),
        fetchStorageLocations(client),
        fetchColors(client)
    ]);

    // 🔹 Stocker globalement
    categories = fetchedCategories;
    allStyles = fetchedStyles;
    organizations = fetchedOrganizations;
    storageLocations = fetchedStorageLocations;
    allColors = fetchedColors;

    // 🔹 Initialiser les selects
    await initCategorySelects();
    initStyleSelect();
    initOrganizationSelects();
    initStorageSelect();
    renderColorChips();
}


// -----------------------------
// Catégories & sous-catégories
// -----------------------------
async function initCategorySelects() {
    const categorySelect = dialog.querySelector('#rsb-res-category');
    const subCategorySelect = dialog.querySelector('#rsb-res-subcategory');

    populateSelect(categorySelect, categories, 'id', 'name', 'Sélectionnez une catégorie');

    categorySelect.addEventListener('change', async () => {
        const selectedId = Number(categorySelect.value) || null;
        if (selectedId && !subCategories[selectedId]) {
            subCategories[selectedId] = await fetchSubcategoriesByCategory(client, selectedId);
        }
        populateSelect(subCategorySelect, subCategories[selectedId] || [], 'id', 'name', 'Sélectionnez une sous-catégorie');
        subCategorySelect.value = '';
    });

    if (currentReservable?.category_id) {
        categorySelect.value = currentReservable.category_id;
        if (!subCategories[currentReservable.category_id]) {
            subCategories[currentReservable.category_id] = await fetchSubcategoriesByCategory(client, currentReservable.category_id);
        }
        populateSelect(subCategorySelect, subCategories[currentReservable.category_id] || [], 'id', 'name', 'Sélectionnez une sous-catégorie');
        subCategorySelect.value = currentReservable.subcategory_id || '';
    }
}

// -----------------------------
// Styles
// -----------------------------
function initStyleSelect() {
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


// -----------------------------
// Organisations
// -----------------------------
function initOrganizationSelects() {
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
function initStorageSelect() {
    const storageSelect = dialog.querySelector('#rsb-res-storage');
    populateSelect(storageSelect, storageLocations, 'id', 'name', 'Sélectionnez un stockage');

    if (currentReservable) {
        storageSelect.value = currentReservable.storage_location_id || '';
    }
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
console.log ('currentReservable', currentReservable)
    await initReservableModal();
    if (!modal || !dialog) return;

    const getEl = id => dialog.querySelector(id);

    if (currentReservable.id != null) {
        document.getElementById('rsb-title').textContent = 'Editer un item';

        const fields = {
            '#rsb-res-name': currentReservable.name,
            '#rsb-res-serial_id': currentReservable.serial_id,
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
    
    // 🔹 Ajouter écouteur ESCAPE
    const escListener = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escListener);
        closeReservableModal();
      }
    };
    document.addEventListener('keydown', escListener);

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

    const serial_id = getEl('#rsb-res-serial_id').value.trim();

    const gender = dialog.querySelector('input[name="rsb-res-gender"]:checked')?.value;
    const privacy = dialog.querySelector('input[name="rsb-res-privacy"]:checked')?.value;
    const style_ids = Array.from(dialog.querySelectorAll('#rsb-chips-style .rsb-chip')).map(c => Number(c.dataset.id));
    const color_ids = getSelectedColorIds();
console.log ('color_ids', color_ids)

    const data = {
        id: currentReservable?.id || null,
        name,
        serial_id,
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
        style_ids,
        color_ids
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


function isColorDark(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Perception humaine
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance < 150;
}


// -----------------------------
// Couleurs
// -----------------------------
function renderColorChips() {
    const container = document.getElementById('rsb-grid-colors');
    container.innerHTML = '';

    allColors.forEach(color => {
        const isDark = isColorDark(color.hex_code);

        const chip = document.createElement('div');
        chip.className = 'rsb-chip';
        chip.dataset.id = color.id;
        chip.style.backgroundColor = color.hex_code;
        chip.style.color = isDark ? '#fff' : '#000';
        chip.title = color.name;
        chip.textContent = color.name;

        if (currentReservable?.color_ids?.includes(color.id)) {
            chip.classList.add('selected');
        }

        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
        });

        container.appendChild(chip);
    });
}

function getSelectedColorIds() {
    const container = document.getElementById('rsb-grid-colors');
    const chips = Array.from(container.children);
    console.log('Toutes les chips :', chips);

    const selectedChips = chips.filter(c => c.classList.contains('selected'));
    console.log('Chips sélectionnées :', selectedChips);

    const ids = selectedChips.map(c => Number(c.dataset.id));
    console.log('IDs sélectionnées :', ids);

    return ids;
}
