import { fetchShootingLocationsByIds, updateShootingLocationPictures } from '../libs/sql/index.js';
import { isInstagramUrl, createInstagramBlockquote, getDisplayableImageUrl } from '../libs/image_utils.js';

let globalClient = null;
let currentLocationId = null;
let location = null;
let photos = [];
let modal, title, list, addBtn, saveBtn, closeBtn;
let loadingOverlay = null;

let finishCallback = null;

// -----------------------------
// Charger le modal HTML
// -----------------------------
export async function loadPhotosModal() {
  if (document.getElementById('photos-modal')) return;

  const response = await fetch(`${window.ENV.BASE_PATH}/pages/modal_photos.html`);
  if (!response.ok) throw new Error('Impossible de charger le modal photos');
  const html = await response.text();

  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);

  modal = document.getElementById('photos-modal');
  title = document.getElementById('photos-modal-title');
  list = document.getElementById('photos-list');
  addBtn = document.getElementById('add-photo-btn');
  saveBtn = document.getElementById('save-photos-btn');
  closeBtn = document.getElementById('close-photos-btn');
  loadingOverlay = document.getElementById('photos-loading-overlay');

  addBtn.addEventListener('click', onAddPhoto);
  saveBtn.addEventListener('click', onSave);
  closeBtn.addEventListener('click', closeModal);
}

// -----------------------------
// Ouvrir le modal et charger photos
// -----------------------------
export async function openPhotosModal(client, locationId, locationName, onFinish) {
  globalClient = client;
  currentLocationId = locationId;
  finishCallback = onFinish; // stocker le callback

  await loadPhotosModal();
  if (!modal) return;

  title.textContent = `📷 Photos du lieu : ${locationName}`;
  modal.classList.add('show');
  modal.classList.remove('hidden');

  try {
    const locations = await fetchShootingLocationsByIds(client, [locationId]);
    location = locations[0];
    photos = location?.photos || [];
  } catch (err) {
    console.error('[openPhotosModal] Erreur chargement photos :', err);
    photos = [];
  }

  renderPhotos();
}




async function displayImage(container, url, loadingOverlay) {
  // 🔹 Clear container
  container.innerHTML = '';

  // 🔹 Placeholder par défaut
  const placeholder = document.createElement('img');
  placeholder.src = 'https://placehold.co/70x70?text=+';
  placeholder.style.width = '100%';
  placeholder.style.height = '100%';
  placeholder.style.objectFit = 'cover';
  placeholder.style.display = 'block';
  container.appendChild(placeholder);

  if (!url) return;

  try {
    loadingOverlay?.classList.remove('hidden');
      // 🔹 Cas Instagram
      if (isInstagramUrl(url)) {
        console.log('[displayImage] URL Instagram détectée :', url);

        // Supprime tout ancien embed
        container.innerHTML = '';

        // Crée blockquote
        const bq = createInstagramBlockquote(url);
        bq.classList.add('photo-instagram-preview');

        // Wrapper pour zone visible avec dimensions fixes
        const wrapper = document.createElement('div');
        wrapper.style.width = '300px';
        wrapper.style.height = '300px';
        wrapper.style.overflow = 'hidden';
        wrapper.style.margin = '0 auto';
        wrapper.style.position = 'relative';

        // Force le blockquote à prendre toute la largeur du wrapper
        bq.style.width = '100%';
        bq.style.height = 'auto%';
        bq.style.transform = 'scale(0.5)'; // ajuste la taille si trop grand
        bq.style.transform = 'translateY(-55px)';

        bq.style.transformOrigin = 'center';
        bq.style.transition = 'transform 0.3s';

        wrapper.appendChild(bq);
        container.appendChild(wrapper);

        // Force le processing si Instagram script déjà chargé
        if (window.instgrm) {
          try { window.instgrm.Embeds.process(); }
          catch (e) { console.error(e); }
        }

        return;
      }

    // 🔹 Cas URL classique (Drive ou autre)
    const { url: displayUrl } = await getDisplayableImageUrl(url, { withPreview: true, client: globalClient, DEBUG: false });
    if (displayUrl) {
      container.innerHTML = ''; // Clear previous content
      const imgEl = document.createElement('img');
      imgEl.src = displayUrl;
      imgEl.style.width = '100%';
      imgEl.style.height = '100%';
      imgEl.style.objectFit = 'cover';
      imgEl.style.display = 'block';
      container.appendChild(imgEl);

      // Lien cliquable
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
// Afficher les photos
// -----------------------------
export async function renderPhotos() {
  list.innerHTML = '';

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];

    const row = document.createElement('div');
    row.classList.add('photo-row');
    row.dataset.index = i;
    list.appendChild(row);

    // 🔹 Container stable pour l'image / embed Instagram
    const container = document.createElement('div');
    container.className = 'photo-container';
    container.style.width = '300px';
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.style.borderRadius = '4px';
    container.style.marginRight = '6px';
    row.appendChild(container);

    // 🔹 URL input
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'photo-url';
    urlInput.placeholder = 'URL de la photo';
    urlInput.value = p.url || '';
    row.appendChild(urlInput);

    // 🔹 Caption input
    const captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.className = 'photo-caption';
    captionInput.placeholder = 'Légende (facultatif)';
    captionInput.value = p.caption || '';
    row.appendChild(captionInput);

    // 🔹 Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'photos-btn-danger remove-photo';
    removeBtn.textContent = '🗑️';
    row.appendChild(removeBtn);

    // 🔹 Upload button
    const uploadBtn = document.createElement('input');
    uploadBtn.type = 'file';
    uploadBtn.accept = 'image/*';
    uploadBtn.style.marginLeft = '6px';
    row.appendChild(uploadBtn);

    // -----------------------------
    // Affichage image / Instagram
    // -----------------------------
    await displayImage(container, p.url, loadingOverlay);

    // -----------------------------
    // Événements
    // -----------------------------
    removeBtn.addEventListener('click', () => {
      photos.splice(i, 1);
      renderPhotos();
    });

    urlInput.addEventListener('input', async (e) => {
      photos[i].url = e.target.value.trim();
      await displayImage(container, photos[i].url, loadingOverlay);
    });

    captionInput.addEventListener('input', e => {
      photos[i].caption = e.target.value;
    });

    uploadBtn.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        loadingOverlay?.classList.remove('hidden');
        const data = await globalClient.uploadToDrive(file, "SHOOTING_LOCATION", 300, true);
        photos[i].url = data.drive_url;
        urlInput.value = data.drive_url;
        await displayImage(container, data.drive_url, loadingOverlay);
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
// Sauvegarder photos
// -----------------------------
async function onSave() {
  const cleaned = photos.filter(p => p.url.trim() !== '');
  try {
    await updateShootingLocationPictures(globalClient, currentLocationId, cleaned);

    // 🔹 mettre à jour le nombre de photos dans locations
    if (location) location.photos = [...cleaned];

   // alert('✅ Photos enregistrées');

    // ⚡ appeler finish si défini
    if (typeof modal.finish === 'function') modal.finish();

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

  // ⚡ appeler finish après fermeture
  if (typeof finishCallback === 'function') {
    finishCallback(photos); // renvoie les photos mises à jour
    finishCallback = null;
  }
}
