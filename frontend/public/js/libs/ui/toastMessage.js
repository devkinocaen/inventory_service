// toastMessage.js
// =======================================
// Petite librairie pour afficher des messages "toast"
// =======================================

/**
 * Initialise le container global si nécessaire
 */
function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-end';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Affiche un toast
 * @param {string} message - texte du toast
 * @param {'success'|'error'|'warning'|'info'} type - type de message
 * @param {number} duration - durée en ms (par défaut 5000)
 */
export function showToast(message, type = 'info', duration = 5000) {
  const container = ensureToastContainer();

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.padding = '15px 20px';
  toast.style.marginTop = '10px';
  toast.style.borderRadius = '8px';
  toast.style.color = '#fff';
  toast.style.fontSize = '16px';
  toast.style.fontWeight = '500';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(20px)';
  toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  toast.style.cursor = 'pointer';
  toast.style.minWidth = '220px';
  toast.style.textAlign = 'center';

  // Couleurs selon le type
  switch (type) {
    case 'success':
      toast.style.backgroundColor = '#28a745';
      break;
    case 'error':
      toast.style.backgroundColor = '#dc3545';
      break;
    case 'warning':
      toast.style.backgroundColor = '#ffc107';
      toast.style.color = '#000';
      break;
    default: // info
      toast.style.backgroundColor = '#007bff';
      break;
  }

  // Supprimer au clic
  toast.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove());
  });

  container.appendChild(toast);

  // Apparition animée
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Disparition automatique
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}
