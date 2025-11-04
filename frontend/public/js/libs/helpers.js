import { LOG_LEVEL } from './constants.js';


export async function setStatusMsg(statusMsg, message, isSuccess) {
  if (!statusMsg) return;
  statusMsg.textContent = message;
  statusMsg.style.display = 'block';        // s'assurer que c'est visible
  statusMsg.classList.remove('status-success', 'status-error');

  if (isSuccess) {
    statusMsg.classList.add('status-success');
    statusMsg.style.color = 'green';
  } else {
    statusMsg.classList.add('status-error');
    statusMsg.style.color = 'red';
  }

  // Optionnel : faire disparaître le message après 5 secondes
//  setTimeout(() => { statusMsg.style.display = 'none'; }, 5000);
}

/**
 * Efface le message d'un élément de status ou modal
 * @param {HTMLElement} statusMsg
 */
export function clearStatusMsg(statusMsg) {
  if (!statusMsg) return;
  statusMsg.textContent = '';
  statusMsg.style.display = 'none';
  statusMsg.classList.remove('status-success', 'status-error');
}


export function logError(...args) {
  if (LOG_LEVEL >= 1) console.error('[ERROR]', ...args);
}

export function logWarn(...args) {
  if (LOG_LEVEL >= 2) console.warn('[WARN]', ...args);
}

export function logInfo(...args) {
  if (LOG_LEVEL >= 3) console.info('[INFO]', ...args);
}

export function logDebug(...args) {
  if (LOG_LEVEL >= 4) console.debug('[DEBUG]', ...args);
}


export function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (isNaN(date)) return isoString;

  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}h${pad(date.getMinutes())}`;
}


// Convertit une date formatée "dd/mm/yyyy à hh:mm" en ISO local (sans Z, sans décalage)
export function parseFormattedDateTimeLocal(str) {
  // Exemple d'entrée : "01/07/2026 à 15h30"
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) à (\d{1,2})h(\d{2})$/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh, min] = match;
  const date = new Date(
    parseInt(yyyy, 10),
    parseInt(mm, 10) - 1,
    parseInt(dd, 10),
    parseInt(hh, 10),
    parseInt(min, 10)
  );

  if (isNaN(date)) return null;

  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}



/**
 * Active ou désactive tous les champs d’un formulaire sauf certains éléments (comme le sélecteur de projet).
 *
 * @param {HTMLFormElement} form - L'élément formulaire contenant les champs.
 * @param {boolean} enabled - true pour activer, false pour désactiver.
 */
export function setFormEditable(form, enabled) {
    if (!form) return;
    
    const elements = form.querySelectorAll('input, select, textarea, button');
    if (!enabled) {
        form.classList.add('form-disabled');
    } else {
        form.classList.remove('form-disabled');
    }
    
    elements.forEach(el => {
                     // Ne pas désactiver le sélecteur de projet
                     if (el.id === 'project-select') return;
                     
                     // Ne pas désactiver les boutons de soumission
                     if (el.type === 'submit') return;
                     
                     el.disabled = !enabled;
                     });
    
}

export function toLocalDateTimeString(date) {
  if (!(date instanceof Date)) return date;

  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}



/* -----------------------
   Gestion messages modal
----------------------- */
export function showModalMessage(msg, isError) {
  const div = document.getElementById('modal_message');
  if (!div) return;
  div.textContent = msg;
  div.classList.toggle('error', isError);
  div.classList.toggle('success', !isError);
  div.style.display = 'block';
}

export function clearModalMessage() {
  const div = document.getElementById('modal_message');
  if (!div) return;
  div.textContent = '';
  div.style.display = 'none';
}


/**
 * Formate la durée pour supprimer les heures si elles sont 0
 * @param {string} duration ex: "00:45:00" ou "01:15:30"
 * @returns string ex: "45:00" ou "1:15:30"
 */
export function formatDuration(duration) {
  if (!duration) return '';
  const parts = duration.split(':');
  if (parts.length === 3 && parts[0] === '00') {
    return parts.slice(1).join(':'); // supprime les "00:"
  }
  return duration;
}

/**
 * Convertit une durée au format HH:MM:SS en secondes
 * @param {string} duration - "HH:MM:SS"
 * @returns {number} nombre de secondes
 */
export function durationToSeconds(duration) {
  const parts = duration.split(':').map(Number);

  let h = 0, m = 0, s = 0;

  if (parts.length === 3) {
    [h, m, s] = parts;
  } else if (parts.length === 2) {
    [m, s] = parts;
  } else if (parts.length === 1) {
    [s] = parts;
  }

  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

/**
 * Convertit un nombre de secondes en format HH:MM pour <input type="time">
 * @param {number} totalSeconds
 * @returns {string} "HH:MM"
 */
export function secondsToTimeInput(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

export function getContrastYIQ(hexcolor){
    hexcolor = hexcolor.replace('#','');
    const r = parseInt(hexcolor.substr(0,2),16);
    const g = parseInt(hexcolor.substr(2,2),16);
    const b = parseInt(hexcolor.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}
   

export function isValidNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}


/**
 * Convertit une valeur en Number, ou renvoie null si elle est invalide.
 *
 * Gère les cas : undefined, null, "", "null", NaN.
 *
 * @param {*} value - Valeur à convertir.
 * @returns {number|null}
 */
export function toNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "null"
  ) {
    return null;
  }

  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Convertit une valeur en String ou renvoie null si invalide.
 */
export function toString(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "null"
  ) {
    return null;
  }
  return String(value);
}

/**
 * Convertit une valeur en booléen ou renvoie null si invalide.
 */
export function toBoolean(value) {
  if (value === undefined || value === null || value === "null") {
    return null;
  }
  return Boolean(value);
}

// Fonction utilitaire pour décoder Unicode et les sauts de ligne
export function decodeUnicode(str) {
  if (!str) return '';
  // forcer la conversion en string
  str = String(str);
  
  // Décoder \uXXXX
  str = str.replace(/\\u[\dA-F]{4}/gi, m =>
    String.fromCharCode(parseInt(m.replace("\\u", ""), 16))
  );
  
  // Remplacer les retours à la ligne encodés
  str = str.replace(/\\n/g, '\n');
  
  return str;
}


// Fonction principale pour formater les erreurs du serveur
export function formatServerError(err) {
  if (!err) return 'Erreur inconnue';

  let msg = '';

  try {
    let jsonPart = null;

    // Chercher le JSON dans la chaîne
    if (err.message) {
      const match = err.message.match(/\{.*\}/s);
      if (match) jsonPart = match[0];
    }

    let parsed = null;
    if (jsonPart) {
      try {
        parsed = JSON.parse(jsonPart);
      } catch {
        parsed = null;
      }
    }

    if (parsed && parsed.error) {
      msg = parsed.error.split('\n')[0]; // garder juste la première ligne
    } else if (err.error) {
      msg = err.error;
    } else if (typeof err === 'string') {
      msg = err;
    } else {
      msg = JSON.stringify(err);
    }

    // Décoder les séquences Unicode et les sauts de ligne
    msg = decodeUnicode(msg);

  } catch (e) {
    msg = 'Erreur inconnue';
  }

  return msg;
}

export function formatPhoneNumber(phone_number) {
    if (!phone_number) return "";
                       
    // Retirer tous les caractères sauf chiffres et +
    let cleaned = phone_number.replace(/[^\d+]/g, "");

    let prefix = "";

    // Gestion des indicatifs internationaux (+33, +41, etc.)
    if (cleaned.startsWith("+")) {
        let match = cleaned.match(/^\+\d{1,3}/);
        if (match) {
            prefix = match[0] + " ";
            cleaned = cleaned.slice(match[0].length);
        }
    } else {
        // Cas national
        if (/^\d{9}$/.test(cleaned)) {
            // Si exactement 9 chiffres sans 0 devant, on ajoute un 0
            cleaned = "0" + cleaned;
        } else if (/^\d{10}$/.test(cleaned) && !cleaned.startsWith("0")) {
            // Si 10 chiffres mais sans 0 devant (ex: 6123456789 → 06123456789)
            cleaned = "0" + cleaned.slice(0, 9);
        }
    }

    // Espacer tous les 2 chiffres (par exemple 06 12 34 56 78)
    let spaced = cleaned.replace(/(\d{2})(?=\d)/g, "$1 ");

    return (prefix + spaced).trim();
}

/**
* Normalise le résultat d'un RPC ou tableau.
* - null/undefined → null
* - tableau vide → null
* - tableau avec 1 élément → renvoie l'élément
* - tableau avec >1 élément → throw Error
* - singleton (objet) → renvoie tel quel
*/
export function single(data) {
 if (data == null) return null;

 if (Array.isArray(data)) {
   if (data.length === 0) return null;
   if (data.length === 1) return data[0];
   throw new Error(`Expected singleton but got ${data.length} elements`);
 }

 return data; // déjà un singleton
}


/**
 * Arrondit une date à la minute supérieure ou inférieure
 * @param {Date|string} date - Date ou chaîne ISO
 * @param {'up'|'down'} direction - 'up' = arrondi supérieur, 'down' = arrondi inférieur
 * @returns {string} - Date formatée pour input[type="datetime-local"]
 */
export function roundDateByMinute(date, direction = 'down') {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : new Date(date);

  if (direction === 'up' && (d.getSeconds() > 0 || d.getMilliseconds() > 0)) {
    d.setMinutes(d.getMinutes() + 1);
  }
  d.setSeconds(0, 0); // supprime secondes et millisecondes

  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Formate une valeur date/heure ou string "HH:MM:SS" en "HH:MM" pour input[type="time"]
 * @param {Date|string} value
 * @returns {string} ex: "09:00"
 */
export function formatTimeForInput(value) {
  if (!value) return '';
  
  // Si c'est une Date, on récupère HH:MM
  if (value instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  // Si c'est une string "HH:MM:SS" ou "HH:MM"
  if (typeof value === 'string') {
    const match = value.match(/^(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
  }

  return '';
}


/**
 * Convertit un horaire "HH:MM:SS" en nombre décimal d'heures
 * ex: "10:30:00" -> 10.5, "01:15:00" -> 1.25
 * @param {string} str
 * @returns {number|null} nombre d'heures, ou null si invalide
 */
export function timeStringToHours(str) {
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.length < 2) return null;
  const [h, m] = parts;
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
}
