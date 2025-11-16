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
    fetchSubcategories,
    fetchSubcategoriesByCategory,
    upsertSubcategory,
    deleteSubcategory
} from '../libs/sql/index.js';

import { setStatusMsg,
    formatDateTime,
    formatTimeForInput,
    roundDateByMinute,
    formatServerError
} from '../libs/helpers.js';

import { createModal } from '../libs/ui/createModal.js';
import { populateSelect } from '../libs/ui/populateSelect.js';

const client = await initClient();

let currentSessionId = null;
let currentEventId = null;
let sessions = [];


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


function updateButtonState() {
    const btnSaveConfig = document.getElementById('btnSaveConfig');

    if (!btnSaveConfig) return;

    // 🔹 Save : activé si une session est sélectionnée ou sessionJourCheckbox cochée
    btnSaveConfig.disabled = !sessionJourCheckbox.checked && !sessionSelect.value;
}


async function refreshEventAndSessionSelects() {
    const statusMsg = document.getElementById('statusMsg');

    try {
        const configData = await fetchAppConfig(client);

        // 🔹 Met à jour la version du schéma et le viewer_allowed
        const appVersionInput = document.getElementById('appVersion');
        const schemaVersionInput = document.getElementById('schemaVersion');
        const viewerAllowedCheckbox = document.getElementById('viewerAllowed');

        if (appVersionInput) appVersionInput.value = configData?.app_version || 'Inconnue';
        if (schemaVersionInput) schemaVersionInput.value = configData?.schema_version || 'Inconnue';
        if (viewerAllowedCheckbox) viewerAllowedCheckbox.checked = !!configData?.viewer_allowed;

        updateButtonState();

        const user = JSON.parse(localStorage.getItem("loggedUser") || "{}");

    } catch (err) {
        console.error('refreshEventAndSessionSelects: erreur', err);
        setStatusMsg(statusMsg, 'Erreur lors du rafraîchissement des événements et sessions.', false);
    }
}

export async function init() {
    const btnSaveConfig = document.getElementById('btnSaveConfig');
    const statusMsg = document.getElementById('statusMsg');

    // 🔹 Sauvegarde configuration
    btnSaveConfig.addEventListener('click', async () => {
        btnSaveConfig.disabled = true;
        setStatusMsg(statusMsg, 'Sauvegarde en cours...', true);

        try {
            let newSessionId = null;

            if (!sessionJourCheckbox.checked) {
                const selectedValue = sessionSelect.value;

                if (!selectedValue || selectedValue === '' || selectedValue === 'null' || selectedValue === 'undefined') {
                    alert('❌ Veuillez sélectionner une session valide avant de sauvegarder.');
                    return;
                }

                newSessionId = Number(selectedValue);
                if (isNaN(newSessionId)) {
                    alert('❌ La session sélectionnée est invalide.');
                    return;
                }
            } else {
                if (currentSessionId) {
                    newSessionId = currentSessionId;
                } else {
                    alert('❌ Impossible d’utiliser "session du jour" sans session connue.');
                    return;
                }
            }

            await upsertAppConfig(
              client,
              newSessionId,
              useCurrentTime,
              null,
              null,
              document.getElementById('viewerAllowed')?.checked ?? false
            );
                                   
            setStatusMsg(statusMsg, '✅ Configuration sauvegardée avec succès !', true);

        } catch (err) {
            console.error('Erreur sauvegarde config:', err);
            setStatusMsg(statusMsg, `❌ Erreur lors de la sauvegarde : ${err.message}`, false);
        } finally {
            updateButtonState();
        }
    });

    // 🔹 Gestion backups
    const btnCreateBackup = document.getElementById("btnCreateBackup");
    const backupListSelect = document.getElementById("backupList");
    const btnRestoreSelected = document.getElementById("btnRestoreSelected");

    if (btnCreateBackup && backupListSelect && btnRestoreSelected) {

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
                    // Cas inattendu
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

                // 🔹 Détecter si l'erreur indique un schéma ancien
                const errMsg = formatServerError(err).toLowerCase();
                const isOldSchema =  errMsg.includes("version mismatch");


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
                await refreshEventAndSessionSelects();
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
}


export function cleanup() {
  console.log("🧹 config.js --> cleanup");

  const btnSaveConfig = document.getElementById('btnSaveConfig');

  if (btnSaveConfig) btnSaveConfig.replaceWith(btnSaveConfig.cloneNode(true));
    
    const btnRestore = document.getElementById("btnRestore");
    const restoreDateInput = document.getElementById("restoreDate");
    if (btnRestore) btnRestore.replaceWith(btnRestore.cloneNode(true));
    if (restoreDateInput) restoreDateInput.replaceWith(restoreDateInput.cloneNode(true));

}



// 🔹 Gestion Styles / Catégories / Sous-catégories
const styleInput = document.getElementById('styleInput');
const btnAddStyle = document.getElementById('btnAddStyle');
const styleList = document.getElementById('styleList');

const categoryInput = document.getElementById('categoryInput');
const btnAddCategory = document.getElementById('btnAddCategory');
const categoryList = document.getElementById('categoryList');

const subCategoryInput = document.getElementById('subCategoryInput');
const btnAddSubCategory = document.getElementById('btnAddSubCategory');
const subCategoryList = document.getElementById('subCategoryList');

let styles = [];
let categories = [];
let subCategories = {}; // { categoryId: [subcat,...] }
let selectedCategoryId = null;

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
        div.onclick = async () => {
            selectedCategoryId = c.id;
            await loadSubCategories(c.id);
            renderCategories();
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

// --- Event listeners ---
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

btnAddCategory.onclick = async () => {
    const name = categoryInput.value.trim();
    if (!name) return;
    try {
        const newCat = await upsertCategory(client, { name });
        categoryInput.value = '';
        await loadCategories();
    } catch (err) {
        alert(`Erreur ajout catégorie: ${formatServerError(err)}`);
    }
};

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

// --- Initial load ---
await loadStyles();
await loadCategories();
