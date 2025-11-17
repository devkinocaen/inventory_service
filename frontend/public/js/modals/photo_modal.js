import {
    updateReservable,
    fetchReservableById
} from '../libs/sql/index.js';

import {
    getDisplayableImageUrl,
    isInstagramUrl,
    createInstagramBlockquote
} from '../libs/image_utils.js';

let globalClient = null;
let currentReservableId = null;
let photos = [];
let modal, title, list, addBtn, saveBtn, closeBtn;
let loadingOverlay = null;
let finishCallback = null;

// -----------------------------
// Charger le modal HTML
// -----------------------------
export async function loadPhotoModal() {
  if (document.getElementById('photo-modal')) return;

  const response = await fetch(`${window.ENV.BASE_PATH}/pages/photo_modal.html`);
  if (!response.ok) throw new Error('Impossible de charger le modal photos');
  const html = await response.text();

  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);

  modal = document.getElementById('photo-modal');
  title = document.getElementById('photo-modal-title');
  list = document.getElementById('photo-list');
  addBtn = document.getElementById('add-photo-btn');
  saveBtn = document.getElementById('save-photos-btn');
  closeBtn = document.getElementById('close-photos-btn');
  loadingOverlay = document.getElementById('photo-loading-overlay');

  addBtn.addEventListener('click', onAddPhoto);
  saveBtn.addEventListener('click', onSave);
  closeBtn.addEventListener('click', closeModal);
}

// -----------------------------
// Ouvrir le modal et charger photos
// -----------------------------

export async function openPhotoModal(client, reservableId, reservableName, onFinish) {
  globalClient = client;
  currentReservableId = reservableId;
  finishCallback = onFinish;

  await loadPhotoModal();
  if (!modal) return;

  title.textContent = `📷 Photos de l’objet : ${reservableName}`;
  modal.classList.add('show');
  modal.classList.remove('hidden');

  try {
    // 🔹 Récupérer le reservable avec ses photos via le wrapper
    const reservable = await fetchReservableById(client, reservableId);
    photos = reservable?.photos || [];
  } catch (err) {
    console.error('[openPhotoModal] Erreur chargement photos :', err);
    photos = [];
  }

  renderPhotos();
}


// -----------------------------
// Afficher image (URL ou Instagram)
// -----------------------------
async function displayImage(container, url) {
  container.innerHTML = '';

  const placeholder = document.createElement('img');
  placeholder.src = 'https://placehold.co/70x70?text=+';
  placeholder.style.width = '100%';
  placeholder.style.height = '100%';
  placeholder.style.objectFit = 'cover';
  container.appendChild(placeholder);

  if (!url) return;

  try {
    loadingOverlay?.classList.remove('hidden');

    if (isInstagramUrl(url)) {
      container.innerHTML = '';
      const bq = createInstagramBlockquote(url);
      bq.classList.add('photo-instagram-preview');

      const wrapper = document.createElement('div');
      wrapper.style.width = '300px';
      wrapper.style.height = '300px';
      wrapper.style.overflow = 'hidden';
      wrapper.style.margin = '0 auto';
      wrapper.style.position = 'relative';

      bq.style.width = '100%';
      bq.style.height = 'auto';
      bq.style.transform = 'scale(0.5) translateY(-55px)';
      bq.style.transformOrigin = 'center';
      wrapper.appendChild(bq);
      container.appendChild(wrapper);

      if (window.instgrm) window.instgrm.Embeds.process();
      return;
    }

    const { url: displayUrl } = await getDisplayableImageUrl(url, { client: globalClient, withPreview: true });
    if (displayUrl) {
      container.innerHTML = '';
      const imgEl = document.createElement('img');
      imgEl.src = displayUrl;
      imgEl.style.width = '100%';
      imgEl.style.height = '100%';
      imgEl.style.objectFit = 'cover';
      container.appendChild(imgEl);

      const linkWrapper = document.createElement('a');
      linkWrapper.href = url;
      linkWrapper.target = '_blank';
      container.replaceChild(linkWrapper, imgEl);
      linkWrapper.appendChild(imgEl);
    }
  } catch (err) {
    console.error('[displayImage] Erreur affichage image :', err);
    container.innerHTML = '';
    container.appendChild(placeholder);
  } finally {
    loadingOverlay?.classList.add('hidden');
  }
}

// -----------------------------
// Afficher toutes les photos
// -----------------------------
export async function renderPhotos() {
  list.innerHTML = '';

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const row = document.createElement('div');
    row.classList.add('photo-row');
    row.dataset.index = i;
    list.appendChild(row);

    const container = document.createElement('div');
    container.className = 'photo-container';
    container.style.width = '300px';
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.style.borderRadius = '4px';
    container.style.marginRight = '6px';
    row.appendChild(container);

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'photo-url';
    urlInput.placeholder = 'URL de la photo';
    urlInput.value = p.url || '';
    row.appendChild(urlInput);

    const captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.className = 'photo-caption';
    captionInput.placeholder = 'Légende (facultatif)';
    captionInput.value = p.caption || '';
    row.appendChild(captionInput);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'photos-btn-danger remove-photo';
    removeBtn.textContent = '🗑️';
    row.appendChild(removeBtn);

    const uploadBtn = document.createElement('input');
    uploadBtn.type = 'file';
    uploadBtn.accept = 'image/*';
    uploadBtn.style.marginLeft = '6px';
    row.appendChild(uploadBtn);

    await displayImage(container, p.url);

    removeBtn.addEventListener('click', () => {
      photos.splice(i, 1);
      renderPhotos();
    });

    urlInput.addEventListener('input', async (e) => {
      photos[i].url = e.target.value.trim();
      await displayImage(container, photos[i].url);
    });

    captionInput.addEventListener('input', e => {
      photos[i].caption = e.target.value;
    });

    uploadBtn.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        loadingOverlay?.classList.remove('hidden');
        const data = await globalClient.uploadToDrive(file, "RESERVABLE", 300, true);
        photos[i].url = data.drive_url;
        urlInput.value = data.drive_url;
        await displayImage(container, data.drive_url);
      } catch (err) {
        alert('Erreur upload fichier : ' + err.message);
      } finally {
        loadingOverlay?.classList.add('hidden');
      }
    });
  }
}

// -----------------------------
// Ajouter photo
// -----------------------------
function onAddPhoto() {
  photos.push({ url: '', caption: '' });
  renderPhotos();
}

// -----------------------------
// Sauvegarder photos via updateReservable
// -----------------------------
async function onSave() {
  const cleaned = photos.filter(p => p.url.trim() !== '');
  try {
    await updateReservable(globalClient, {
      id: currentReservableId,
      photos: cleaned
    });
    if (typeof finishCallback === 'function') finishCallback(cleaned);
    closeModal();
  } catch (err) {
    alert('Erreur lors de la sauvegarde : ' + err.message);
  }
}

// -----------------------------
// Fermer modal
// -----------------------------
function closeModal() {
  if (!modal) return;
  modal.classList.remove('show');
  modal.classList.add('hidden');
  finishCallback = null;
}
