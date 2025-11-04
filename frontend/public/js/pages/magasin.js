import client from '../libs/client.js';

import {
  fetchEquipmentTypes,
  fetchEquipmentStatuses,
  fetchParticipantRoles,
  fetchParticipantsByRole,
  fetchParticipantsBySession,
  fetchFilteredEquipments,
  insertEquipment,
  updateEquipment,
  deleteEquipments,
  fetchEventById,
  fetchCurrentSession
} from '../libs/sql/index.js';

import { populateSelect } from '../libs/ui/populateSelect.js';
import * as editEquipmentModal from '../modals/modal_edit_equipment.js';
import { openEquipmentPhotosModal } from '../modals/modal_equipment_photos.js';
import { logInfo, logError, setStatusMsg, isValidNumber } from '../libs/helpers.js';

let currentSession = null;
let magasinOwner = null;
let participantRoleMap = new Map();
let initialData = null;
let currentEquipments = []; // variable locale pour stocker la liste en cours

/* -----------------------
   Récupération données initiales
----------------------- */
async function fetchAllInitialData() {
  try {
    currentSession = await fetchCurrentSession(client);
    if (!currentSession?.id) throw new Error('Session courante non trouvée ou invalide');

    // Récupérer l'événement lié à la session
    const event = await fetchEventById(client, currentSession.event_id);
    if (!event?.id) throw new Error('Événement lié à la session introuvable');

    const [types, statuses, roles, participants] = await Promise.all([
      fetchEquipmentTypes(client),
      fetchEquipmentStatuses(client),
      fetchParticipantRoles(client),
      fetchParticipantsBySession(client, currentSession.id, true)
    ]);

    // Définir magasinOwner directement via event.magasin_id
    magasinOwner = participants.find(p => p.id === event.magasin_id) || null;
   // if (magasinOwner) logInfo('Propriétaire magasin identifié via event.magasin_id:', magasinOwner);
   // else logInfo('Aucun propriétaire magasin défini pour cet événement');

    // Vérifications
    if (!Array.isArray(types)) throw new Error("Types d'équipement invalides");
    if (!Array.isArray(statuses)) throw new Error("Statuts d'équipement invalides");
    if (!Array.isArray(roles)) throw new Error("Rôles participants invalides");
    if (!Array.isArray(participants)) throw new Error("Participants invalides");

    // Mapping rôle => id
    participantRoleMap = new Map(roles.map(r => [r.type, r.id]));

    return { types, statuses, participants };
  } catch (error) {
    logError('Erreur lors de la récupération des données initiales:', error);
    throw error;
  }
}


/* -----------------------
   Populate UI
----------------------- */
async function populateUI({ types, statuses, participants }) {
  if (!Array.isArray(types)) types = [];
  if (!Array.isArray(statuses)) statuses = [];
  if (!Array.isArray(participants)) participants = [];

  // Types d’équipement
  const typeSelectIds = ['mag_equipment_type', 'mag_filter_type'];
  typeSelectIds.forEach(id => {
    populateSelect(document.getElementById(id), types, null, {
      valueField: 'id',
      labelField: 'name',
      placeholder: '-- Choisir un type --'
    });
  });

  // Statuts
  populateSelect(document.getElementById('mag_filter_status'), statuses, null, {
    valueField: 'id',
    labelField: 'name',
    placeholder: '-- Choisir un statut --'
  });

  // Participants
  const festivalierId = participantRoleMap.get('festivalier');
  const festivaliers = participants.filter(p => Number(p.role_id) === festivalierId);
  const labelFn = p => `${p.first_name} ${p.last_name}`;

 // ---- Propriétaires ----
  const selectMagOwner = document.getElementById('mag_equipment_owner');
  populateSelect(selectMagOwner, festivaliers, null, {
    valueField: 'id',
    labelField: labelFn,
    placeholder: '-- Choisir un propriétaire --'
  });

  const selectMagFilterOwner = document.getElementById('mag_filter_owner');
  populateSelect(selectMagFilterOwner, festivaliers, null, {
    valueField: 'id',
    labelField: labelFn,
    placeholder: '-- Choisir un propriétaire --'
  });
  if (magasinOwner && selectMagFilterOwner) {
    const exists = Array.from(selectMagFilterOwner.options).some(opt => Number(opt.value) === magasinOwner.id);
    if (!exists) {
      const option = document.createElement('option');
      option.value = magasinOwner.id;
      option.text = `${magasinOwner.first_name} ${magasinOwner.last_name} (MAG)`;
      selectMagFilterOwner.insertBefore(option, selectMagFilterOwner.firstChild);
    }
  }

  // Managers
  const managerSelectIds = ['mag_equipment_manager'];
  managerSelectIds.forEach(id => {
    populateSelect(document.getElementById(id), participants, null, {
      valueField: 'id',
      labelField: labelFn,
      placeholder: '-- Choisir un gestionnaire --'
    });
  });

  // --- Populate filtre nature directement ---
  const filterNature = document.getElementById('mag_filter_nature');
  if (filterNature) {
    filterNature.innerHTML = `
      <option value="">-- Tout --</option>
      <option value="Magasin">Magasin</option>
      <option value="Participant">Participant</option>
    `;
  }

  // --- Ajouter listeners pour mise à jour du tableau ---
  const selectTypeFilter = document.getElementById('mag_filter_type');
  const selectStatusFilter = document.getElementById('mag_filter_status');
  const selectOwnerFilter = document.getElementById('mag_filter_owner');

  [selectTypeFilter, selectStatusFilter, selectOwnerFilter, filterNature].forEach(el => {
    if (el) el.addEventListener('change', () => updateTable());
  });
}


/* -----------------------
   Fetch Equipments
----------------------- */

async function fetchEquipments(filters) {
  try {
    const equipmentTypeId = filters.type;
    const equipmentStatusId = filters.status;
    const ownerId         = filters.owner;
    const participantRole = filters.participantRole;

    const festivalierRoleId = participantRoleMap.get('festivalier');
    const magRoleId         = participantRoleMap.get('MAG');

    // Cas 1 : gestionnaire = festivalier
    if (participantRole === festivalierRoleId) {
      return await fetchFilteredEquipments(client, currentSession.id, {
        p_equipment_type_id: equipmentTypeId,
        p_equipment_status_id: equipmentStatusId,
        p_owner_id: ownerId,
        p_manager_id: ownerId,
        p_participant_role_id: festivalierRoleId
      });
    }

    // Cas 2 : gestionnaire = magasin
    if (participantRole === magRoleId) {
      const currentEvent = await fetchEventById(client, currentSession.event_id);
      if (!currentEvent) throw new Error('Événement introuvable');
        

      return await fetchFilteredEquipments(client, currentSession.id, {
        p_equipment_type_id: equipmentTypeId,
        p_equipment_status_id: equipmentStatusId,
        p_owner_id: ownerId,
        p_manager_id: currentEvent.magasin_id
      });
    }

    // Cas 3 : pas de filtre sur le gestionnaire
    return await fetchFilteredEquipments(client, currentSession.id, {
      p_equipment_type_id: equipmentTypeId,
      p_equipment_status_id: equipmentStatusId,
      p_owner_id: ownerId
    });

  } catch (err) {
    console.error('[fetchEquipments] erreur:', err);
    throw err;
  }
}

/* -----------------------
   Render table
----------------------- */
function renderEquipmentsTable(equipments) {
  const tbody = document.querySelector('#mag_equipments_table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // garder la référence à jour
  currentEquipments = equipments;

  equipments.forEach(eq => {

    const owner = initialData.participants.find(p => p.id === eq.owner_id);
    const manager = initialData.participants.find(p => p.id === eq.manager_id);

    const ownerName = owner ? `${owner.first_name} ${owner.last_name}` : '—';
    const managerName = manager ? `${manager.first_name} ${manager.last_name}` : '—';
    const typeName = eq.type_name || `ID:${eq.type_id}`;

    const tr = document.createElement('tr');
    tr.dataset.id = eq.id;
    tr.dataset.type = eq.type_id;

    tr.innerHTML = `
      <td>${eq.name}</td>
      <td>${managerName}</td>
      <td>${ownerName}</td>
      <td>${typeName}</td>
      <td>${eq.status_name || '—'}</td>
      <td>${eq.description || ''}</td>
      <td>${eq.notes || ''}</td>
     <td>
       <button type="button" id="equipment-photos-btn" data-id="${eq.id}">
         📷 ${eq.photos?.length || 0}
       </button>
     </td>
      <td><input type="checkbox" name="supprimer[]" value="${eq.id}"></td>
    `;

    tbody.appendChild(tr);
    
        // -----------------------------
       // ⚡ Ajouter bouton Photos
       // -----------------------------
       const photosBtn = tr.querySelector('#equipment-photos-btn');
       photosBtn?.addEventListener('click', () => {
         if (!eq || !client) return;
         openEquipmentPhotosModal(
           client, eq,
           updatedPhotos => {
             // Mettre à jour les photos locales
             eq.photos = updatedPhotos;
             // Mettre à jour le compteur affiché sur le bouton
             photosBtn.textContent = `📷 ${updatedPhotos.length || 0}`;
           }
         );
       });
   });

}

/* -----------------------
   Sorting table
----------------------- */
function makeTableSortable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const headers = table.querySelectorAll('thead th[data-sortable="true"]');
  let sortState = { index: null, asc: true };

  headers.forEach((th, index) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const asc = (sortState.index === index) ? !sortState.asc : true;
      sortState = { index, asc };

      // Trier les lignes du tbody directement
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const valA = a.cells[index].textContent.trim().toLowerCase();
        const valB = b.cells[index].textContent.trim().toLowerCase();
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });

      rows.forEach(row => tbody.appendChild(row));

      // Mettre à jour l’affichage des flèches
      headers.forEach(h => h.textContent = h.textContent.replace(/[↑↓]/g,''));
      th.textContent += asc ? ' ↑' : ' ↓';
    });
  });
}

/* -----------------------
   Delegated dblclick
----------------------- */
document.querySelector('#mag_equipments_table tbody')
.addEventListener('dblclick', async e => {
  const cell = e.target.closest('td');
  const row = e.target.closest('tr');
  if (!cell || !row) return;

  const eqId = Number(row.dataset.id);
  const eq = currentEquipments.find(item => item.id === eqId);
  if (!eq) return;

  const cellIndex = cell.cellIndex;

  // --- Colonne statut (5ème = index 4) ---
  if (cellIndex === 4) {
    const oldStatusId = eq.status_id;
    cell.textContent = '';
    const select = document.createElement('select');

    initialData.statuses.forEach(s => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = s.name;
      if (s.id === eq.status_id) option.selected = true;
      select.appendChild(option);
    });

    cell.appendChild(select);
    select.focus();

    const cancelEdit = () => {
      cell.textContent =
        initialData.statuses.find(s => s.id === eq.status_id)?.name || '—';
      select.remove();
    };

    select.addEventListener('change', async () => {
      const newStatusId = Number(select.value);
      if (newStatusId !== eq.status_id) {
        eq.status_id = newStatusId;
        try {
          await updateEquipment(client, eq);
          eq.status_name =
            initialData.statuses.find(s => s.id === eq.status_id)?.name || '—';
        } catch (err) {
          console.error('[renderEquipmentsTable] Échec update status :', err);
          eq.status_id = oldStatusId;
        }
      }
      cell.textContent =
        initialData.statuses.find(s => s.id === eq.status_id)?.name || '—';
    });

    select.addEventListener('blur', cancelEdit);
    select.addEventListener('keydown', ev => { if (ev.key === 'Escape') cancelEdit(); });

  // --- Colonne description (6ème = index 5) ---
  } else if (cellIndex === 5) {
    const oldValue = eq.description || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldValue;
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();

    const cancelEdit = () => { cell.textContent = oldValue; };

    const saveEdit = async () => {
      const newValue = input.value.trim();
      if (newValue !== oldValue) {
        eq.description = newValue;
        try { await updateEquipment(client, eq); }
        catch (err) {
          console.error('[renderEquipmentsTable] Échec update description :', err);
          eq.description = oldValue;
        }
      }
      cell.textContent = eq.description || '';
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') saveEdit();
      if (ev.key === 'Escape') cancelEdit();
    });

  // --- Colonne notes (7ème = index 6) ---
  } else if (cellIndex === 6) {
    const oldValue = eq.notes || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldValue;
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();

    const cancelEdit = () => { cell.textContent = oldValue; };

    const saveEdit = async () => {
      const newValue = input.value.trim();
      if (newValue !== oldValue) {
        eq.notes = newValue;
        try { await updateEquipment(client, eq); }
        catch (err) {
          console.error('[renderEquipmentsTable] Échec update notes :', err);
          eq.notes = oldValue;
        }
      }
      cell.textContent = eq.notes || '';
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') saveEdit();
      if (ev.key === 'Escape') cancelEdit();
    });

  // --- Autres colonnes : ouvrir modal ---
  } else {
    editEquipmentModal.openEditModal(eq, {
      client,
      types: initialData.types,
      statuses: initialData.statuses,
      participants: initialData.participants,
      updateTableFn: updateTable,
      readOnly: false
    });
  }
});


/* -----------------------
   Update Table
----------------------- */
export async function updateTable() {
  const selectType = document.getElementById('mag_filter_type');
  const selectStatus = document.getElementById('mag_filter_status');
  const selectOwner = document.getElementById('mag_filter_owner');
  const filterNature = document.getElementById('mag_filter_nature');

  const filters = {
    type: selectType?.value || null,
    status: selectStatus?.value || null,
    owner: (!selectOwner?.disabled && selectOwner?.value) ? selectOwner.value : null,
    participantRole: null,
  };

  const nature = filterNature?.value;
  if (nature === 'Magasin') filters.participantRole = participantRoleMap.get('MAG');
  else if (nature === 'Participant') filters.participantRole = participantRoleMap.get('festivalier');

  const equipments = await fetchEquipments(filters);
  renderEquipmentsTable(equipments);
}


/* -----------------------
   Setup Add Equipment Form
----------------------- */
function setupAddEquipmentForm() {
  const form = document.getElementById('mag_form_add_equipment');
  if (!form) return;

  const selectOwnerForm = document.getElementById('mag_equipment_owner');
  const checkboxOwner = document.getElementById('mag_equipment_is_magasin');
  const selectManager = document.getElementById('mag_equipment_manager');
  const checkboxManager = document.getElementById('mag_equipment_is_managed_by_magasin');

  const inputName = form.querySelector('#mag_equipment_name');
  const selectTypeForm = form.querySelector('#mag_equipment_type');
  const inputDescription = form.querySelector('#mag_equipment_description');
  const inputNotes = form.querySelector('#mag_equipment_notes');
  const messageDiv = form.querySelector('#mag_form_add_equipment_message');

  // --- gérer le manager ---
  function updateSelectManagerEnabled() {
    if (checkboxManager.checked) {
      selectManager.disabled = true;
      selectManager.value = magasinOwner?.id || '';
    } else if (checkboxOwner.checked) {
      selectManager.disabled = true;
      selectManager.value = magasinOwner?.id || '';
    } else if (selectOwnerForm.value) {
      // propriétaire participant => manager = owner et désactivé
      selectManager.disabled = true;
      selectManager.value = selectOwnerForm.value;
    } else {
      selectManager.disabled = false;
      selectManager.value = '';
    }
  }

  // --- gérer le propriétaire ---
  function updateSelectOwnerEnabled() {
    if (checkboxOwner.checked) {
      selectOwnerForm.disabled = true;
      selectOwnerForm.value = magasinOwner?.id || '';
      checkboxManager.checked = true;
      updateSelectManagerEnabled();
    } else {
      selectOwnerForm.disabled = false;
      updateSelectManagerEnabled();
    }
  }

  // --- mettre à jour le manager si un participant est choisi ---
  selectOwnerForm.addEventListener('change', updateSelectManagerEnabled);

  // Écouteurs
  checkboxOwner.addEventListener('change', updateSelectOwnerEnabled);
  checkboxManager.addEventListener('change', updateSelectManagerEnabled);

  // Initialisation
  updateSelectOwnerEnabled();
  updateSelectManagerEnabled();

  // --- Listener submit ---
  form.addEventListener('submit', async e => {
    e.preventDefault();
    messageDiv.textContent = '';
    messageDiv.classList.remove('success', 'error');

    const name = inputName.value.trim();
    const typeId = parseInt(selectTypeForm.value, 10);
    const description = inputDescription.value.trim();
    const notes = inputNotes.value.trim();

    let ownerId = null;
    if (!name) return setStatusMsg(messageDiv, "Le nom de l'équipement est obligatoire.", false);
    if (isNaN(typeId)) return setStatusMsg(messageDiv, "Le type de l'équipement est obligatoire.", false);

    if (checkboxOwner.checked) {
      if (!magasinOwner) return setStatusMsg(messageDiv, 'Impossible de trouver le magasin parmi les participants', false);
      ownerId = magasinOwner.id;
    } else {
      const selectedOwner = parseInt(selectOwnerForm.value, 10);
      if (isNaN(selectedOwner)) return setStatusMsg(messageDiv, "Le propriétaire de l'équipement est obligatoire.", false);
      ownerId = selectedOwner;
    }

    let managerId = checkboxManager.checked ? (magasinOwner?.id || ownerId) : parseInt(selectManager.value, 10);
    if (!managerId) managerId = null;

    // Contrôle
    if (ownerId !== managerId && managerId !== magasinOwner?.id) {
      return alert('Impossible d’enregistrer : le gestionnaire doit être le MAG si différent du propriétaire.');
    }

    try {
      await insertEquipment(client, {
        name,
        type_id: typeId,
        owner_id: ownerId,
        manager_id: managerId,
        status_id: 1,
        description,
        notes
      });
      setStatusMsg(messageDiv, `Équipement "${name}" ajouté avec succès.`, true);
      form.reset();
      updateSelectOwnerEnabled();
      await updateTable();
      logInfo(`Équipement ajouté: ${name} (type_id=${typeId}, owner_id=${ownerId})`);
    } catch (err) {
      setStatusMsg(messageDiv, `Erreur ajout équipement : ${err.message || err}`, false);
      logError('Erreur ajout équipement :', err);
    }
  });
}

/* -----------------------
   Setup Delete Button
----------------------- */
function setupDeleteButton() {
  const deleteBtn = document.getElementById('mag_btn_delete_selected');
  if (!deleteBtn) return;

  deleteBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('input[name="supprimer[]"]:checked');
    if (!checkboxes.length) return alert('Aucun équipement sélectionné.');
    if (!confirm(`Supprimer ${checkboxes.length} équipement(s) ?`)) return;

    const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value));

    try {
      const result = await deleteEquipments(client, idsToDelete, { force: false });

      if (result.warning) {
        if (!confirm(result.warning + '\nVoulez-vous forcer la suppression ?')) return alert('Suppression annulée par l’utilisateur.');
        await deleteEquipments(client, idsToDelete, { force: true });
        alert(`${idsToDelete.length} équipement(s) et leurs réservations supprimé(s) ✅`);
      } else alert(`${idsToDelete.length} équipement(s) supprimé(s) ✅`);

      await updateTable();
    } catch (err) {
      console.error('[delete] erreur lors de la suppression:', err);
      alert(`Erreur lors de la suppression : ${err.message || err}`);
    }
  });
}

// --- Filtrage dynamique du tableau par nom ---
const inputLookup = document.getElementById('lookup_equipment_name');
const tableBody = document.querySelector('#mag_equipments_table tbody');

inputLookup.addEventListener('input', () => {
  const filter = inputLookup.value.toLowerCase();

  Array.from(tableBody.rows).forEach(row => {
    const nameCell = row.cells[0]; // la colonne "Nom"
    if (!nameCell) return;
    const text = nameCell.textContent.toLowerCase();
    row.style.display = text.includes(filter) ? '' : 'none';
  });
});


/* -----------------------
   Init
----------------------- */
export async function init() {
  try {
    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }

    initialData = await fetchAllInitialData();
    await populateUI(initialData);

    setupAddEquipmentForm();
    setupDeleteButton();

    if (currentSession.id) {
      await updateTable();
      makeTableSortable('mag_equipments_table'); // <-- ajouter ici
    } else console.warn('Données incomplètes pour appel initial à updateTable');
      
  } catch (err) {
    logError('Erreur lors de l\'initialisation:', err);
  }
}
