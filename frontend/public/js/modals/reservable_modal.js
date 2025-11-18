import { initClient } from '../libs/client.js';
import {
    fetchReservableById,
    updateReservable,
    fetchCategories,
    fetchSubcategoriesByCategory,
    fetchStyles
} from '../libs/sql/index.js';

import { populateSelect } from '../libs/ui/populateSelect.js';
import { formatServerError } from '../libs/helpers.js';

let client;
let modal, dialog;
let cancelBtn, saveBtn;
let currentReservable = null;

let allStyles = [];
let categories = [];
let subCategories = {}; // { categoryId: [subcat,...] }

// -----------------------------
// Initialisation client et modal
// -----------------------------
export async function initReservableModal() {
    await loadReservableModal();
    await loadCategorySelects();
    await loadStyles(); // Charger tous les styles
}

// -----------------------------
// Charger le modal HTML
// -----------------------------
export async function loadReservableModal() {
    if (!document.getElementById('rsb-modal-reservable')) {
        const response = await fetch(`${window.ENV.BASE_PATH}/pages/reservable_modal.html`);
        if (!response.ok) throw new Error('Impossible de charger le modal reservable');
        const html = await response.text();
        const div = document.createElement('div');
        div.innerHTML = html;
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
// Charger catégories et sous-catégories
// -----------------------------
async function loadCategorySelects() {
    categories = await fetchCategories(client);
    const categorySelect = dialog.querySelector('#rsb-res-category');
    const subCategorySelect = dialog.querySelector('#rsb-res-subcategory');

    populateSelect(categorySelect, categories, 'id', 'name', 'Sélectionnez une catégorie');

    categorySelect.addEventListener('change', async () => {
        const selectedCatId = Number(categorySelect.value) || null;
        await loadSubCategories(selectedCatId);
        populateSelect(subCategorySelect, subCategories[selectedCatId] || [], 'id', 'name', 'Sélectionnez une sous-catégorie');
        subCategorySelect.value = '';
    });

    if (currentReservable && currentReservable.category_id) {
        categorySelect.value = currentReservable.category_id;
        await loadSubCategories(currentReservable.category_id);
        populateSelect(subCategorySelect, subCategories[currentReservable.category_id] || [], 'id', 'name', 'Sélectionnez une sous-catégorie');
        if (currentReservable.subcategory_id) {
            subCategorySelect.value = currentReservable.subcategory_id;
        }
    }
}

async function loadSubCategories(categoryId) {
    if (!categoryId) return;
    subCategories[categoryId] = await fetchSubcategoriesByCategory(client, categoryId);
}

// -----------------------------
// Charger styles
// -----------------------------
async function loadStyles() {
    allStyles = await fetchStyles(client);

    // 🔹 Remplir le select "Ajouter un style"
    const styleSelect = dialog.querySelector('#rsb-res-add-style');
    populateSelect(styleSelect, allStyles, 'id', 'name', 'Ajouter un style');

    // 🔹 Listener pour ajouter un style en chip
    styleSelect.addEventListener('change', () => {
        const selectedId = Number(styleSelect.value);
        if (!selectedId) return;
        const selectedStyle = allStyles.find(s => s.id === selectedId);
        if (!selectedStyle) return;

        addStyleChip(selectedStyle);
        styleSelect.value = ''; // reset select
    });

    // 🔹 Rendre les chips déjà présents pour currentReservable
    renderStyleChips();
}

function renderStyleChips() {
    const chipsContainer = dialog.querySelector('#rsb-chips-style');
    chipsContainer.innerHTML = '';

    if (!currentReservable?.style_ids?.length) return;

    currentReservable.style_ids.forEach(id => {
        const s = allStyles.find(st => st.id === id);
        if (s) addStyleChip(s);
    });
}

function addStyleChip(style) {
    const chipsContainer = dialog.querySelector('#rsb-chips-style');

    // Éviter doublons
    if (Array.from(chipsContainer.children).some(c => c.dataset.id == style.id)) return;

    const chip = document.createElement('div');
    chip.className = 'rsb-chip';
    chip.dataset.id = style.id;
    chip.innerHTML = `${style.name} <button type="button">✕</button>`;

    // Supprimer chip au clic sur le bouton
    chip.querySelector('button').addEventListener('click', e => {
        e.stopPropagation();
        chip.remove();
    });

    chipsContainer.appendChild(chip);
}


// -----------------------------
// Ouvrir / Fermer modal
// -----------------------------
export async function openReservableModal(reservableId) {
    client = await initClient();
    currentReservable = reservableId ? await fetchReservableById(client, reservableId) : null;

    await initReservableModal();
    if (!modal || !dialog) return;

    const getEl = id => dialog.querySelector(id);

    if (currentReservable) {
        getEl('#rsb-res-name').value = currentReservable.name || '';
        getEl('#rsb-res-size').value = currentReservable.size || '';
        getEl('#rsb-res-price').value = currentReservable.price_per_day != null ? currentReservable.price_per_day : '';
        getEl('#rsb-res-description').value = currentReservable.description || '';

        getEl('#rsb-res-status').value = currentReservable.status || 'disponible';
        getEl('#rsb-res-quality').value = currentReservable.quality || 'neuf';
        getEl('#rsb-res-category').value = currentReservable.category_id || '';
        getEl('#rsb-res-subcategory').value = currentReservable.subcategory_id || '';
        getEl('#rsb-res-owner').value = currentReservable.owner_id || '';
        getEl('#rsb-res-manager').value = currentReservable.manager_id || '';
        getEl('#rsb-res-storage').value = currentReservable.storage_id || '';

        const genderRadio = dialog.querySelectorAll('input[name="rsb-res-gender"]');
        genderRadio.forEach(r => r.checked = r.value === currentReservable.gender);

        const privacyRadio = dialog.querySelectorAll('input[name="rsb-res-privacy"]');
        privacyRadio.forEach(r => r.checked = r.value === currentReservable.privacy);

        renderStyleChips();
    } else {
        dialog.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.type === 'radio') el.checked = false;
            else el.value = '';
        });
        dialog.querySelector('input[name="rsb-res-gender"][value="unisex"]').checked = true;
        dialog.querySelector('input[name="rsb-res-privacy"][value="public"]').checked = true;
        renderStyleChips();
    }

    modal.classList.remove('hidden');
    void dialog.offsetWidth;
    dialog.classList.add('show');
}

export function closeReservableModal() {
    if (!modal || !dialog) return;
    dialog.classList.remove('show');
    modal.classList.add('hidden');
    currentReservable = null;
}

// -----------------------------
// Sauvegarder reservable
// -----------------------------
async function saveReservable(e) {
    e.preventDefault();
    const getEl = id => dialog.querySelector(id);
    const name = getEl('#rsb-res-name').value.trim();
    if (!name) {
        alert('Le nom est obligatoire.');
        return;
    }

    const genderRadio = dialog.querySelector('input[name="rsb-res-gender"]:checked');
    const privacyRadio = dialog.querySelector('input[name="rsb-res-privacy"]:checked');

    const styles = Array.from(dialog.querySelectorAll('#rsb-chips-style .rsb-chip.selected'))
                        .map(c => c.textContent.trim());

    const updateData = {
        id: currentReservable?.id || null,
        name,
        type: getEl('#rsb-res-type')?.value || null,
        size: getEl('#rsb-res-size').value || null,
        price_per_day: parseFloat(getEl('#rsb-res-price').value) || null,
        description: getEl('#rsb-res-description').value || null,
        status: getEl('#rsb-res-status').value || null,
        quality: getEl('#rsb-res-quality').value || null,
        category_id: getEl('#rsb-res-category').value || null,
        subcategory_id: getEl('#rsb-res-subcategory').value || null,
        owner_id: getEl('#rsb-res-owner').value || null,
        manager_id: getEl('#rsb-res-manager').value || null,
        storage_id: getEl('#rsb-res-storage').value || null,
        gender: genderRadio ? genderRadio.value : null,
        privacy: privacyRadio ? privacyRadio.value : null,
        styles
    };

    try {
        const saved = await updateReservable(client, updateData);
        console.log('Reservable enregistré', saved);
        alert('✅ Reservable enregistré avec succès.');
    } catch (err) {
        console.error('[updateReservable]', err);
        alert(`❌ Impossible d’enregistrer :\n\n${formatServerError(err)}`);
    }
}
