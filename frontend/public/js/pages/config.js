import { initClient } from '../libs/client.js';

import {
    fetchAppConfig,
    upsertAppConfig,
    fetchStyles,
    upsertStyle,
    deleteStyle,
    fetchCategories,
    upsertCategory,
    deleteCategory,
    fetchSubcategoriesByCategory,
    upsertSubcategory,
    deleteSubcategory,
    fetchStorageLocations,
    upsertStorageLocation,
    deleteStorageLocation,
    fetchOrganizations
} from '../libs/sql/index.js';

import {
    setStatusMsg,
    formatDateTime,
    formatServerError
} from '../libs/helpers.js';

import { createModal } from '../libs/ui/createModal.js';
import { populateSelect } from '../libs/ui/populateSelect.js';

let client = null;
let appConfig = null;

let storageLocations = [];
let styles = [];
let categories = [];
let subCategories = {}; // { categoryId: [subcat,...] }
let selectedCategoryId = null;

let storageListEl = null;
let storageNameEl = null;
let storageAddressEl = null;
let addStorageBtn = null;


// 🔹 Gestion Styles / Catégories / Sous-catégories
const btnAddStyle = document.getElementById('btnAddStyle');
const styleList = document.getElementById('styleList');

const categoryInput = document.getElementById('categoryInput');
const btnAddCategory = document.getElementById('btnAddCategory');
const categoryList = document.getElementById('categoryList');

const subCategoryInput = document.getElementById('subCategoryInput');
const btnAddSubCategory = document.getElementById('btnAddSubCategory');
const subCategoryList = document.getElementById('subCategoryList');


// 🔹 Fonction dédiée pour charger la config et initialiser les champs
async function loadAppConfig() {
    try {
        appConfig = await fetchAppConfig(client);
        if (!appConfig) return;

        // Viewer allowed
        const viewerAllowedEl = document.getElementById('viewerAllowed');
        if (viewerAllowedEl) {
            viewerAllowedEl.checked = !!appConfig.viewer_allowed;
        }

        // On peut aussi initialiser owner_id, manager_id et storage_location_id
        const ownerSelect = document.getElementById('defaultOwner');
        const managerSelect = document.getElementById('defaultManager');
        const storageSelect = document.getElementById('defaultStorageLocation');

        const showPricesEl = document.getElementById('showPrices');

        if (ownerSelect && appConfig.owner_id) ownerSelect.value = appConfig.owner_id;
        if (managerSelect && appConfig.manager_id) managerSelect.value = appConfig.manager_id;
        if (storageSelect && appConfig.storage_location_id) storageSelect.value = appConfig.storage_location_id;
        if (showPricesEl) showPricesEl.checked = !!appConfig.show_prices;
        

    } catch (err) {
        console.error('Erreur lecture config:', formatServerError(err));
        const statusMsg = document.getElementById('statusMsg');
        setStatusMsg(statusMsg, '❌ Impossible de lire la configuration', false);
    }
}


function showLoadingOverlay(message = "⏳ Patienter quelques minutes...") {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
        overlay.textContent = message;
        overlay.style.display = "block";
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.style.display = "none";
}

// 🔹 Rafraîchit les selects Manager, Owner et Storage Location
async function refreshManagerAndStorageSelects() {
    try {
        const ownerSelect = document.getElementById('defaultOwner');
        const managerSelect = document.getElementById('defaultManager');
        const storageSelect = document.getElementById('defaultStorageLocation');


        // 🔹 Storage locations
        storageLocations = await fetchStorageLocations(client);
        if (storageSelect) {
            populateSelect(storageSelect, storageLocations, 'id', 'name');
            // 🔹 Initialisation avec la config
            if (appConfig?.default_storage_location_id) {
                storageSelect.value = appConfig.default_storage_location_id;
            }
        }

        // 🔹 Owners et Managers (organisations)
        const orgs = await fetchOrganizations(client);
        if (ownerSelect) {
            populateSelect(ownerSelect, orgs, 'id', 'name');

            // 🔹 Initialisation avec la config
            if (appConfig?.default_owner_id) {
                ownerSelect.value = appConfig.default_owner_id;
            }
        }
        if (managerSelect) {
            populateSelect(managerSelect, orgs, 'id', 'name');

            // 🔹 Initialisation avec la config
            if (appConfig?.default_manager_id) {
                managerSelect.value = appConfig.default_manager_id;
            }
        }

    } catch (err) {
        console.error('refreshManagerAndStorageSelects: erreur', err);
        const statusMsg = document.getElementById('statusMsg');
        setStatusMsg(statusMsg, '❌ Erreur lors du rafraîchissement des selects', false);
    }
}



// --- Render functions ---
function renderStyles() {
    styleList.innerHTML = '';
    styles.forEach(s => {
        const div = document.createElement('div');
        div.className = 'item';
        div.textContent = s.name;
        div.onclick = async () => {
            if (confirm(`Supprimer le style "${s.name}" ?`)) {
                try {
                    await deleteStyle(client, s.id);
                    await loadStyles();
                } catch (err) {
                    alert(`Erreur suppression style: ${formatServerError(err)}`);
                }
            }
        };
        styleList.appendChild(div);
    });
}

function renderCategories() {
    categoryList.innerHTML = '';
    categories.forEach(c => {
        const div = document.createElement('div');
        div.className = 'item' + (selectedCategoryId === c.id ? ' selected' : '');
        div.textContent = c.name;

        let clickTimer = null;

        div.onclick = async () => {
            if (clickTimer == null) {
                clickTimer = setTimeout(async () => {
                    // Clic simple : sélection de la catégorie
                    selectedCategoryId = c.id;
                    await loadSubCategories(c.id);
                    renderCategories();
                    clickTimer = null;
                }, 250); // 250ms pour différencier du double-clic
            }
        };

        div.ondblclick = async () => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            // Double-clic : suppression
            if (confirm(`Supprimer la catégorie "${c.name}" et toutes ses sous-catégories ?`)) {
                try {
                    await deleteCategory(client, c.id);
                    await loadCategories();
                    selectedCategoryId = null;
                    renderSubCategories();
                } catch (err) {
                    alert(`Erreur suppression catégorie: ${formatServerError(err)}`);
                }
            }
        };

        categoryList.appendChild(div);
    });
}


function renderSubCategories() {
    subCategoryList.innerHTML = '';
    if (!selectedCategoryId) {
        subCategoryList.innerHTML = '<i>Sélectionnez une catégorie</i>';
        return;
    }
    const list = subCategories[selectedCategoryId] || [];
    list.forEach(sc => {
        const div = document.createElement('div');
        div.className = 'item';
        div.textContent = sc.name;
        div.onclick = async () => {
            if (confirm(`Supprimer la sous-catégorie "${sc.name}" ?`)) {
                try {
                    await deleteSubcategory(client, sc.id);
                    await loadSubCategories(selectedCategoryId);
                } catch (err) {
                    alert(`Erreur suppression sous-catégorie: ${formatServerError(err)}`);
                }
            }
        };
        subCategoryList.appendChild(div);
    });
}

// --- Load data ---
async function loadStyles() {
    styles = await fetchStyles(client);
    renderStyles();
}

async function loadCategories() {
    categories = await fetchCategories(client);
    renderCategories();
}

async function loadSubCategories(categoryId) {
    subCategories[categoryId] = await fetchSubcategoriesByCategory(client, categoryId);
    renderSubCategories();
}

async function loadStorageLocations() {
    storageLocations = await fetchStorageLocations(client);
    renderStorageLocations();
}

function renderStorageLocations() {
    storageListEl.innerHTML = '';
    storageLocations.forEach(loc => {
        const div = document.createElement('div');
        div.className = 'item';
        div.textContent = loc.name;
        div.onclick = async () => {
            if (confirm(`Supprimer le lieu "${loc.name}" ?`)) {
                try {
                    await deleteStorageLocation(client, loc.id);
                    await loadStorageLocations();
                    await refreshManagerAndStorageSelects();
                } catch (err) {
                    alert(`Erreur suppression lieu: ${formatServerError(err)}`);
                }
            }
        };
        storageListEl.appendChild(div);
    });
}

function attachStorageLocationListeners() {
    if (!addStorageBtn) return;

    addStorageBtn.onclick = async () => {
        const name = storageNameEl.value.trim();
        const address = storageAddressEl.value.trim();
        if (!name) return;

        try {
            await upsertStorageLocation(client, { name, address });
            storageNameEl.value = '';
            storageAddressEl.value = '';
            await loadStorageLocations();
            await refreshManagerAndStorageSelects();
        } catch (err) {
            alert(`Erreur ajout lieu: ${formatServerError(err)}`);
        }
    };
}



// --- Event listeners internes (ajout style/catégorie/sous-catégorie) ---
function attachStyleCategoryListeners() {
    const styleInput = document.getElementById('styleInput');
    const btnAddStyle = document.getElementById('btnAddStyle');
    const categoryInput = document.getElementById('categoryInput');
    const btnAddCategory = document.getElementById('btnAddCategory');
    const subCategoryInput = document.getElementById('subCategoryInput');
    const btnAddSubCategory = document.getElementById('btnAddSubCategory');

    // Styles
    btnAddStyle.onclick = async () => {
        const name = styleInput.value.trim();
        if (!name) return;
        try {
            await upsertStyle(client, { name });
            styleInput.value = '';
            await loadStyles();
        } catch (err) {
            alert(`Erreur ajout style: ${formatServerError(err)}`);
        }
    };

    // Catégories
    btnAddCategory.onclick = async () => {
        const name = categoryInput.value.trim();
        if (!name) return;
        try {
            await upsertCategory(client, { name });
            categoryInput.value = '';
            await loadCategories();
        } catch (err) {
            alert(`Erreur ajout catégorie: ${formatServerError(err)}`);
        }
    };

    // Sous-catégories
    btnAddSubCategory.onclick = async () => {
        if (!selectedCategoryId) {
            alert('❌ Sélectionnez d’abord une catégorie');
            return;
        }
        const name = subCategoryInput.value.trim();
        if (!name) return;
        try {
            await upsertSubcategory(client, { categoryId: selectedCategoryId, name });
            subCategoryInput.value = '';
            await loadSubCategories(selectedCategoryId);
        } catch (err) {
            alert(`Erreur ajout sous-catégorie: ${formatServerError(err)}`);
        }
    };
}



// --- Storage manager (sera implémenté plus tard) ---
function initStorageManager() {
    storageListEl = document.getElementById('storage-list');
    storageNameEl = document.getElementById('storage-name');
    storageAddressEl = document.getElementById('storage-address');
    addStorageBtn = document.getElementById('add-storage-btn');

    attachStorageLocationListeners(); // 👈 on relie les listeners ici
}





async function initBackups() {
    const btnCreateBackup = document.getElementById("btnCreateBackup");
    const backupListSelect = document.getElementById("backupList");
    const btnRestoreSelected = document.getElementById("btnRestoreSelected");
    const statusMsg = document.getElementById('statusMsg');

    if (!btnCreateBackup || !backupListSelect || !btnRestoreSelected) return;

    function setBackupButtonsDisabled(disabled, message = "") {
        btnCreateBackup.disabled = disabled;
        btnRestoreSelected.disabled = disabled;
        if (statusMsg) {
            statusMsg.textContent = message;
        }
    }

    // 🔹 Créer un backup
    btnCreateBackup.addEventListener("click", async () => {
        setBackupButtonsDisabled(true, "⏳ Création du backup en cours...");
        try {
            const result = await client.createBackup(true);

            if (result.status === "skipped") {
                alert(`⚠️ Backup non nécessaire : ${result.reason}`);
            } else if (result.status === "success") {
                alert("✅ Backup créé !");
                await loadBackupList();
            } else {
                console.warn("⚠️ Résultat backup inattendu :", result);
                alert("⚠️ Résultat backup inattendu, consultez la console");
            }
        } catch (err) {
            console.error(formatServerError(err));
            alert("❌ Erreur création backup : " + formatServerError(err));
        } finally {
            setBackupButtonsDisabled(false, "");
        }
    });

    // 🔹 Restaurer le backup sélectionné
    btnRestoreSelected.addEventListener("click", async () => {
        const selectedOption = backupListSelect.selectedOptions[0];
        if (!selectedOption) {
            alert("❌ Veuillez sélectionner un backup à restaurer.");
            return;
        }

        const drive_file_id = selectedOption.value;
        const backupName = selectedOption.textContent;

        const confirmRestore = confirm(
            `⚠️ Vous êtes sur le point de restaurer le backup:\n${backupName}\n` +
            `Toutes les données actuelles seront écrasées. Voulez-vous continuer ?`
        );
        if (!confirmRestore) return;

        setBackupButtonsDisabled(true, `⏳ Restauration du backup "${backupName}" en cours...`);
        showLoadingOverlay(`⏳ Restauration du backup "${backupName}" en cours...`);

        try {
            // 🔹 Première passe : strict
            await client.restoreFromFile(drive_file_id, true);
            alert(`✅ Backup ${backupName} restauré avec succès!`);
        } catch (err) {
            console.error("Erreur restauration backup (strict):", formatServerError(err));

            const errMsg = formatServerError(err).toLowerCase();
            const isOldSchema = errMsg.includes("version mismatch");

            if (isOldSchema) {
                const confirmTolerant = confirm(
                    `⚠️ Le backup semble issu d'un ancien schema.\n` +
                    `Voulez-vous essayer une restauration partielle (mode TOLERANT) ?`
                );
                if (!confirmTolerant) return;

                try {
                    await client.restoreFromFile(drive_file_id, false); // ← tolerant mode
                    alert(`✅ Backup ${backupName} restauré avec succès en mode TOLERANT !`);
                } catch (err2) {
                    console.error("Erreur restauration backup (tolerant):", formatServerError(err2));
                    alert(`❌ Échec restauration même en mode TOLERANT : ${formatServerError(err2)}`);
                }
            } else {
                alert(`❌ Erreur lors de la restauration : ${formatServerError(err)}`);
            }
        } finally {
            hideLoadingOverlay();
            setBackupButtonsDisabled(false, "");
            await loadBackupList();
        }
    });

    // 🔹 Charger la liste des backups
    async function loadBackupList() {
        try {
            const backups = await client.listBackups(true);
            backupListSelect.innerHTML = "";
            backups.forEach(b => {
                const opt = document.createElement("option");
                opt.value = b.id;
                const dateStr = b.backup_time ? formatDateTime(b.backup_time) : "Date inconnue";
                opt.textContent = `${b.name || b.filename || 'Backup'} - ${dateStr}`;
                backupListSelect.appendChild(opt);
            });
        } catch (err) {
            console.error(formatServerError(err));
            backupListSelect.innerHTML = '<option disabled>Impossible de charger la liste des backups</option>';
        }
    }

    await loadBackupList();
}

// 🔹 Gestion de la sauvegarde de la configuration
function initAppConfigSave() {
    const btnSaveConfig = document.getElementById('btnSaveConfig');
    const statusMsg = document.getElementById('statusMsg');

    if (!btnSaveConfig || !statusMsg) return;

    btnSaveConfig.addEventListener('click', async () => {
        btnSaveConfig.disabled = true;
        setStatusMsg(statusMsg, 'Sauvegarde en cours...', true);

        try {
            // Récupère les valeurs depuis les selects et checkbox
            const ownerSelect = document.getElementById('defaultOwner');
            const managerSelect = document.getElementById('defaultManager');
            const storageSelect = document.getElementById('defaultStorageLocation');
            const viewerAllowed = document.getElementById('viewerAllowed')?.checked ?? false;
            const showPrices = document.getElementById('showPrices')?.checked ?? false;

            const storage_location_id = storageSelect?.value ? Number(storageSelect.value) : null;
            const owner_id = ownerSelect?.value ? Number(ownerSelect.value) : null;
            const manager_id = managerSelect?.value ? Number(managerSelect.value) : null;

            // 🔹 Appel avec le nouvel objet
            await upsertAppConfig(client, {
                appName: 'costumerie de Julie',
                viewerAllowed,
                showPrices,
                defaultOwnerId: owner_id,
                defaultManagerId: manager_id,
                defaultStorageLocationId: storage_location_id
            });

            setStatusMsg(statusMsg, '✅ Configuration sauvegardée avec succès !', true);

        } catch (err) {
            console.error('Erreur sauvegarde config:', err);
            setStatusMsg(statusMsg, `❌ Erreur lors de la sauvegarde : ${formatServerError(err)}`, false);
        } finally {
            btnSaveConfig.disabled = false;
        }
    });
}



export async function init() {
    if (!client) client = await initClient();

    // 🔹 Charger la config
    await loadAppConfig();

    // 🔹 Configuration application (session / viewer_allowed)
    initAppConfigSave();

    // 🔹 Backups
    await initBackups();

    // 🔹 Styles / Catégories / Sous-catégories
    attachStyleCategoryListeners();
    await loadStyles();
    await loadCategories();

    // 🔹 Storage manager (préparer les éléments)
    initStorageManager();
    await loadStorageLocations(); // <-- ajout

    // 🔹 Rafraîchit les selects manager / owner / storage
    await refreshManagerAndStorageSelects();
}


export function cleanup() {
  console.log("🧹 config.js --> cleanup");

  const btnSaveConfig = document.getElementById('btnSaveConfig');

  if (btnSaveConfig) btnSaveConfig.replaceWith(btnSaveConfig.cloneNode(true));
    
    const btnRestoreSelected = document.getElementById("btnRestoreSelected");
    if (btnRestoreSelected) btnRestoreSelected.replaceWith(btnRestoreSelected.cloneNode(true));
}
