import client from '../libs/client.js';

import {
    fetchAppConfig,
    upsertAppConfig,
    fetchEventById,
    fetchEvents,
    deleteEvent,
    fetchSessionsByEvent,
    fetchSessionById,
    updateEvent,
    updateSession
} from '../libs/sql/index.js';

import { setStatusMsg,
    formatDateTime,
    formatTimeForInput,
    roundDateByMinute,
    formatServerError
} from '../libs/helpers.js';

import { createModal } from '../libs/ui/createModal.js';
import { populateSelect } from '../libs/ui/populateSelect.js';


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
    const sessionSelect = document.getElementById('sessionSelect');
    const eventSelect = document.getElementById('eventSelect');
    const sessionJourCheckbox = document.getElementById('sessionJourCheckbox');
    const btnSaveConfig = document.getElementById('btnSaveConfig');
    const btnEditEvent = document.getElementById('btnEditEvent');
    const btnEditSession = document.getElementById('btnEditSession');

    if (!btnSaveConfig) return;

    // 🔹 Save : activé si une session est sélectionnée ou sessionJourCheckbox cochée
    btnSaveConfig.disabled = !sessionJourCheckbox.checked && !sessionSelect.value;

    // 🔹 Bouton éditer événement : activé si un événement est sélectionné
    if (btnEditEvent) btnEditEvent.disabled = !eventSelect?.value;

    // 🔹 Bouton éditer session : activé si une session est sélectionnée
    if (btnEditSession) btnEditSession.disabled = !sessionSelect?.value;
}


async function refreshEventAndSessionSelects() {
    const eventSelect = document.getElementById('eventSelect');
    const sessionSelect = document.getElementById('sessionSelect');
    const sessionJourCheckbox = document.getElementById('sessionJourCheckbox');
    const statusMsg = document.getElementById('statusMsg');
    const btnDeleteEvent = document.getElementById('btnDeleteEvent');

    try {
        const configData = await fetchAppConfig(client);
        currentSessionId = configData?.current_session_id || null;
        const useCurrentTime = configData?.use_current_time || false;

        // 🔹 Met à jour la version du schéma et le viewer_allowed
        const appVersionInput = document.getElementById('appVersion');
        const schemaVersionInput = document.getElementById('schemaVersion');
        const viewerAllowedCheckbox = document.getElementById('viewerAllowed');

        if (appVersionInput) appVersionInput.value = configData?.app_version || 'Inconnue';
        if (schemaVersionInput) schemaVersionInput.value = configData?.schema_version || 'Inconnue';
        if (viewerAllowedCheckbox) viewerAllowedCheckbox.checked = !!configData?.viewer_allowed;

        
        let currentSession = null;
        currentEventId = null;
        if (currentSessionId) {
            currentSession = await fetchSessionById(client, currentSessionId);
            if (currentSession) currentEventId = currentSession.event_id;
        }

        // 🔹 Remplir le select des événements
        const events = await fetchEvents(client);
        populateSelect(eventSelect, events, currentEventId, {
            valueField: 'id',
            labelField: 'name',
            placeholder: 'Sélectionnez un événement'
        });

        // 🔹 Remplir le select des sessions
        sessions = [];
        if (currentEventId) {
            sessions = await fetchSessionsByEvent(client, currentEventId);
            if (sessions.length > 0) {
                populateSelect(sessionSelect, sessions, currentSessionId, {
                    valueField: 'id',
                    labelField: 'name',
                    placeholder: 'Sélectionnez une session'
                });
                sessionSelect.disabled = useCurrentTime;
            } else {
                sessionSelect.innerHTML = '<option disabled selected>Aucune session disponible</option>';
                sessionSelect.disabled = true;
            }
        } else {
            sessionSelect.innerHTML = '<option disabled selected>Sélectionnez un événement d\'abord</option>';
            sessionSelect.disabled = true;
        }

        sessionJourCheckbox.checked = useCurrentTime;
        updateButtonState();

        const user = JSON.parse(localStorage.getItem("loggedUser") || "{}");
        if (!['dev', 'admin'].includes(user.role)) {
            btnDeleteEvent.disabled = true;
            btnDeleteEvent.title = "Vous n’avez pas les droits pour supprimer un événement";
        } else if (currentEventId) {
            btnDeleteEvent.disabled = false;
        }
    } catch (err) {
        console.error('refreshEventAndSessionSelects: erreur', err);
        setStatusMsg(statusMsg, 'Erreur lors du rafraîchissement des événements et sessions.', false);
    }
}

export async function init() {
    const eventSelect = document.getElementById('eventSelect');
    const sessionSelect = document.getElementById('sessionSelect');
    const sessionJourCheckbox = document.getElementById('sessionJourCheckbox');
    const btnSaveConfig = document.getElementById('btnSaveConfig');
    const statusMsg = document.getElementById('statusMsg');
    const btnDeleteEvent = document.getElementById('btnDeleteEvent');


    // 🔹 Initialise les selects et la config utilisateur
    try {
        await refreshEventAndSessionSelects();
    } catch (err) {
        console.error('init: erreur lors du refresh initial', err);
        setStatusMsg(statusMsg, 'Erreur lors du chargement de la configuration.', false);
    }

    // 🔹 Changement d'événement
    eventSelect.addEventListener('change', async () => {
        const selectedEventId = parseInt(eventSelect.value);
        currentEventId = selectedEventId || null;

        if (!currentEventId) {
            sessionSelect.innerHTML = '<option disabled selected>Sélectionnez un événement d\'abord</option>';
            sessionSelect.disabled = true;
            sessions = [];
            updateButtonState();
            if (btnDeleteEvent) btnDeleteEvent.disabled = true;
            return;
        }

        sessions = await fetchSessionsByEvent(client, currentEventId);

        if (sessions.length === 0) {
            sessionSelect.innerHTML = '<option disabled selected>Aucune session disponible</option>';
            sessionSelect.disabled = true;
        } else {
            populateSelect(sessionSelect, sessions, currentSessionId, {
                valueField: 'id',
                labelField: 'name',
                placeholder: 'Sélectionnez une session'
            });
            sessionSelect.disabled = sessionJourCheckbox.checked;
        }

        if (btnDeleteEvent) btnDeleteEvent.disabled = false;
        updateButtonState();
    });

    // 🔴 Ajout écouteur bouton suppression
    if (btnDeleteEvent) {
        btnDeleteEvent.addEventListener('click', async () => {
            const eventId = parseInt(eventSelect.value, 10);
            if (!eventId) return;

            const user = JSON.parse(localStorage.getItem("loggedUser") || "{}");

            if (!user.role || !['dev', 'admin'].includes(user.role)) {
                alert("❌ Vous n'avez pas les droits pour supprimer un événement !");
                return;
            }

            const confirmation = confirm(
                `⚠️ Voulez-vous vraiment supprimer l'événement ${eventId} et toutes ses données liées ?`
            );
            if (!confirmation) return;

            const confirmation2 = confirm(
                `⚠️ Attention ! Ceci va supprimer tous les projets, sessions, réservations d'équipements et de stations de montage liées à cet événement.\n\nÊtes-vous sûr de vouloir continuer ?`
            );
            if (!confirmation2) return;

            try {
                await deleteEvent(client, eventId);
                setStatusMsg(statusMsg, `✅ Événement ${eventSelect.selectedOptions[0].text} supprimé avec succès`, true);

                eventSelect.querySelector(`option[value="${eventId}"]`)?.remove();
                eventSelect.value = '';
                if (btnDeleteEvent) btnDeleteEvent.disabled = true;

                sessionSelect.innerHTML = '<option disabled selected>Sélectionnez un événement d\'abord</option>';
                sessionSelect.disabled = true;

            } catch (err) {
                console.error('Erreur suppression event:', err);
                setStatusMsg(statusMsg, '❌ Erreur lors de la suppression de l\'événement', false);
            }
        });
    }

    // 🔹 Changement de session
    sessionSelect.addEventListener('change', () => updateButtonState());

    // 🔹 Checkbox "session du jour"
    sessionJourCheckbox.addEventListener('change', () => {
        sessionSelect.disabled = sessionJourCheckbox.checked;
        updateButtonState();
    });

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

            const useCurrentTime = sessionJourCheckbox.checked;

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

  const eventSelect = document.getElementById('eventSelect');
  const sessionSelect = document.getElementById('sessionSelect');
  const sessionJourCheckbox = document.getElementById('sessionJourCheckbox');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const btnDeleteEvent = document.getElementById('btnDeleteEvent');

  if (eventSelect) eventSelect.replaceWith(eventSelect.cloneNode(true));
  if (sessionSelect) sessionSelect.replaceWith(sessionSelect.cloneNode(true));
  if (sessionJourCheckbox) sessionJourCheckbox.replaceWith(sessionJourCheckbox.cloneNode(true));
  if (btnSaveConfig) btnSaveConfig.replaceWith(btnSaveConfig.cloneNode(true));
  if (btnDeleteEvent) btnDeleteEvent.replaceWith(btnDeleteEvent.cloneNode(true));
    
    const btnRestore = document.getElementById("btnRestore");
    const restoreDateInput = document.getElementById("restoreDate");
    if (btnRestore) btnRestore.replaceWith(btnRestore.cloneNode(true));
    if (restoreDateInput) restoreDateInput.replaceWith(restoreDateInput.cloneNode(true));

}

// 🔹 Bouton Éditer l'événement
const btnEditEvent = document.getElementById('btnEditEvent');
const eventSelect = document.getElementById('eventSelect');

btnEditEvent?.addEventListener('click', async () => {
  const eventId = parseInt(eventSelect.value);
  if (!eventId) return;

  const ev = await fetchEventById(client, eventId);
                               console.log ('ev', ev)

  createModal('Éditer l’événement', [
    { key: 'name', label: 'Nom', value: ev.name },
    { key: 'description', label: 'Description', value: ev.description || '', type: 'textarea' },
    { key: 'address', label: 'Adresse postale', value: ev.address || '' },
    { key: 'geographic_area', label: 'Zone géographique', value: ev.geographic_area || '' },
    { key: 'start_date', label: 'Début', value: ev.start_date ? roundDateByMinute(ev.start_date) : '', type: 'datetime-local' },
    { key: 'end_date', label: 'Fin', value: ev.end_date ? roundDateByMinute(ev.end_date, 'up') : '', type: 'datetime-local' },
    { key: 'lab_opening_time', label: 'Lab ouverture', value: formatTimeForInput(ev.lab_opening_time), type: 'time' },
    { key: 'lab_closing_time', label: 'Lab fermeture', value: formatTimeForInput(ev.lab_closing_time), type: 'time' },
    { key: 'mag_opening_time', label: 'Mag ouverture', value: formatTimeForInput(ev.mag_opening_time), type: 'time' },
    { key: 'mag_closing_time', label: 'Mag fermeture', value: formatTimeForInput(ev.mag_closing_time), type: 'time' }
  ], async (fields) => {
    await updateEvent(client, eventId, fields);
  });
}); // ← fermeture manquante du premier listener

// 🔹 Bouton Éditer la session
const btnEditSession = document.getElementById('btnEditSession');
const sessionSelect = document.getElementById('sessionSelect');

btnEditSession?.addEventListener('click', async () => {
  const sessionId = parseInt(sessionSelect.value);
  if (!sessionId) return;

  const session = await fetchSessionById(client, sessionId);
  if (!session) return;

  createModal(
    'Éditer la session',
    [
      { key: 'name', label: 'Nom', value: session.name },
      { key: 'description', label: 'Description', value: session.description || '', type: 'textarea' },
      { key: 'start_date', label: 'Début', value: roundDateByMinute(session.start_date) || '', type: 'datetime-local' },
      { key: 'end_date', label: 'Fin', value: roundDateByMinute(session.end_date) || '', type: 'datetime-local' },
      { key: 'film_max_duration', label: 'Durée max film', value: session.film_max_duration || '' },
      { key: 'quickie_max_duration', label: 'Durée max quickie', value: session.quickie_max_duration || '' },
      { key: 'num_screening_blocks', label: 'Nombre de blocs', value: session.num_screening_blocks || '' },
      { key: 'num_max_films_per_screening_block', label: 'Max films par bloc', value: session.num_max_films_per_screening_block || '' }
    ],
    async (fields) => {
      await updateSession(client, sessionId, fields);
    }
  );
});
