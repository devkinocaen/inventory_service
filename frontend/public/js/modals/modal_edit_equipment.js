import {
    fetchFilteredEquipments,
    updateEquipment,
    fetchCurrentSession,
    fetchEventById
} from '../libs/sql/index.js';

import { populateSelect } from '../libs/ui/populateSelect.js';
import { setStatusMsg, clearStatusMsg, isValidNumber } from '../libs/helpers.js';

let currentEquipment = null;
let currentSession = null;

// --- Chargement du HTML du modal ---
async function loadModalEditEquipment() {
  if (document.getElementById('equipment-modal')) return;

  const response = await fetch(`${window.ENV.BASE_PATH}/pages/modal_edit_equipment.html`);
  if (!response.ok) throw new Error('Impossible de charger le modal');

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const modalWrapper = document.createElement('div');
  modalWrapper.innerHTML = doc.body.innerHTML;
  document.body.appendChild(modalWrapper);
}

// --- Population des champs du modal ---
function populateEquipmentFields(equipment, context) {
  const setFieldValue = (id, value = '') => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  setFieldValue('modal_equipment_name', equipment.name);
  setFieldValue('modal_equipment_description', equipment.description);
  setFieldValue('modal_equipment_notes', equipment.notes);

  populateSelect(
    document.getElementById('modal_equipment_owner'),
    context.participants,
    equipment.owner_id,
    { valueField: 'id', labelField: p => `${p.first_name} ${p.last_name}` }
  );
  document.getElementById('modal_equipment_owner').disabled = true;
    
  populateSelect(document.getElementById('modal_equipment_type'), context.types, equipment.type_id);
  populateSelect(document.getElementById('modal_equipment_status'), context.statuses, equipment.status_id);

  const owner = context.participants.find(o => Number(o.id) === Number(equipment.owner_id));
  const emailInput = document.getElementById('modal_equipment_owner_email');
  const phoneInput = document.getElementById('modal_equipment_owner_phone');
  if (emailInput) emailInput.value = owner?.email ?? '';
  if (phoneInput) phoneInput.value = owner?.mobile_phone ?? '';
    
    
    // --- Radios "Géré par" ---
    const radios = document.getElementsByName('modal_equipment_manager');

    // Cherche le participant de rôle MAG
    const magParticipant = context.participants.find(p => p.role_name?.toUpperCase() === 'MAG');
    if (magParticipant && equipment.manager_id === magParticipant.id) {
      // Coche "le Mag"
      radios.forEach(radio => radio.checked = radio.value === 'mag');
    } else if (equipment.manager_id === equipment.owner_id) {
      // Coche "Son propriétaire"
      radios.forEach(radio => radio.checked = radio.value === 'owner');
    } else {
      // Aucun cas connu → alerte
      alert(`⚠️ Manager inconnu pour l'équipement ${equipment.name} (manager_id=${equipment.manager_id})`);
      radios.forEach(radio => radio.checked = false); // décocher toutes les radios
    }

}

// --- Ouverture du modal ---
export async function openEditModal(equipment, context = {}) {
  if (!equipment) throw new Error('Équipement introuvable.');

  currentSession = await fetchCurrentSession(context.client);
    
  await loadModalEditEquipment();
  populateEquipmentFields(equipment, context);

  clearStatusMsg(document.getElementById('status_message'));
  currentEquipment = equipment;

  initModalEvents(context);
  openModal();

  if (context.readOnly) setFormReadOnly(true);
}

// --- Mise en lecture seule ---
function setFormReadOnly(readOnly) {
  const form = document.getElementById('modal_form_edit_equipment');
  if (!form) return;

  form.querySelectorAll('input, textarea, select, button').forEach(el => {
    if (el.id === 'cancel_edit_project') return;
    el.disabled = readOnly;
  });

  if (readOnly) form.onsubmit = e => e.preventDefault();
}

// --- Initialisation des événements ---
let listenersAttached = false;
function initModalEvents(context) {
  if (listenersAttached) return;
  listenersAttached = true;

  const form = document.getElementById('modal_form_edit_equipment');
  const closeBtn = document.getElementById('modal-close-button');
  const closeSpan = document.getElementById('modal-close-span');

  closeBtn?.addEventListener('click', closeModal);
  closeSpan?.addEventListener('click', closeModal);

  if (form) {
    // Wrapper pour transmettre context
    form.addEventListener('submit', e => handleFormSubmit(e, context));
  }
}

// --- Soumission du formulaire ---
async function handleFormSubmit(e, context) {
  e.preventDefault();
  clearStatusMsg(document.getElementById('status_message'));

  if (!currentEquipment || !context.client) return;

  const id = currentEquipment.id; //parseInt(document.getElementById('modal_equipment_id')?.value, 10);
  const name = document.getElementById('modal_equipment_name')?.value.trim();
  const typeId = parseInt(document.getElementById('modal_equipment_type')?.value, 10);
  const statusId = parseInt(document.getElementById('modal_equipment_status')?.value, 10);
  const description = document.getElementById('modal_equipment_description')?.value.trim();
  const notes = document.getElementById('modal_equipment_notes')?.value.trim();
  const ownerId = parseInt(document.getElementById('modal_equipment_owner')?.value, 10);
  let managerId = null;
    
    const selectedRadio = document.querySelector('input[name="modal_equipment_manager"]:checked');
    if (!selectedRadio) return;
console.log ('selectedRadio.value:', selectedRadio.value)
    if (selectedRadio.value === 'mag') {
      const currentEvent = await fetchEventById(context.client, currentSession?.event_id);
        console.log ("currentEvent", currentEvent)
      managerId = currentEvent?.magasin_id || '';
    } else if (selectedRadio.value === 'owner') {
      managerId = ownerId;
    }
    
    if (!name || isNaN(typeId) || isNaN(statusId)) {
    return setStatusMsg(document.getElementById('status_message'), 'Nom, type et statut sont obligatoires.', false);
    }
       
    if (!isValidNumber(id)) {
     return setStatusMsg(document.getElementById('status_message'), "ID d'équipement invalide", false);
    }

    if (!isValidNumber(ownerId)) {
     return setStatusMsg(document.getElementById('status_message'), "ID Propriétaire invalide", false);
    }

    if (!isValidNumber(managerId)) {
       return setStatusMsg(document.getElementById('status_message'), "ID Gestionnaire invalide", false);
    }
    

  try {
    const payload = { id, name, type_id: typeId, owner_id: ownerId, manager_id: managerId, status_id: statusId, description, notes };
      
      
    await updateEquipment(context.client, payload);
    setStatusMsg(document.getElementById('status_message'), '✅ Équipement mis à jour avec succès.', true);
    await context.updateTableFn()
  } catch (err) {
    console.error('[submit] updateEquipment error:', err);
    setStatusMsg(document.getElementById('status_message'), `❌ Erreur : ${err.message || err}`, false);
  }
}

// --- Ouverture du modal ---
export function openModal() {
  const modal = document.getElementById('equipment-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('show');
  clearStatusMsg(document.getElementById('status_message'));
}

// --- Fermeture du modal ---
export function closeModal() {
  const modal = document.getElementById('equipment-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.classList.add('hidden');
  clearStatusMsg(document.getElementById('status_message'));
}
