import { initClient } from '../libs/client.js';

import {
    fetchAppConfig,
    upsertAppConfig,
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

