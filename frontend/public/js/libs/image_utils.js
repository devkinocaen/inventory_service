import { formatServerError } from './helpers.js';

// --- Cache mémoire pour Drive (plein format) ---
// fileId -> { objectUrl: string, mime: string, ts: number }
const driveImageCache = new Map();

let MAX_CACHE_SIZE = 100;
let CACHE_TTL_MS = null;
let autoCleanupIntervalId = null;


// ------------------------------
// 1️⃣ addToCache
// ------------------------------
function addToCache(file_id, objectUrl, mime, filename) {
  if (!file_id || !objectUrl) return;

  if (driveImageCache.has(file_id)) {
    try { URL.revokeObjectURL(driveImageCache.get(file_id).objectUrl); } catch (e) {}
    driveImageCache.delete(file_id);
  }

  driveImageCache.set(file_id, { objectUrl, mime, filename, ts: Date.now() });
  cleanupCacheBySize();
}



// ------------------------------
// 2️⃣ getDriveImageFull
// ------------------------------
export async function getDriveImageFull(client, file_id, DEBUG = false) {
  if (!file_id) throw new Error("file_id required");

  // Vérifier le cache
  if (driveImageCache.has(file_id)) {
    if (DEBUG) console.log("⚡ Cache hit for:", file_id);
    const cached = driveImageCache.get(file_id);
    cached.ts = Date.now();
    driveImageCache.set(file_id, cached);
    return { objectUrl: cached.objectUrl, mime: cached.mime, filename: cached.filename };
  }

  // Appel au serveur pour récupérer le blob et le MIME correct
  const { url: objectUrl, mime, filename } = await client.getDriveImage(file_id, DEBUG);

  // Ajouter au cache
  addToCache(file_id, objectUrl, mime, filename);

  return { objectUrl, mime, filename };
}

// ------------------------------
// 3️⃣ getDisplayableImageUrl
// ------------------------------
export async function getDisplayableImageUrl(rawUrl, { withPreview = true, client, DEBUG = false } = {}) {
  if (!rawUrl) return { url: null, filename: null, mime: null };

  if (DEBUG) console.log("🔹 rawUrl:", rawUrl);

  // Détecter Google Drive
  const gdriveMatch =
    rawUrl.match(/drive\.google\.com\/(?:file\/d\/|uc\?id=|open\?id=)([a-zA-Z0-9_-]+)/) ||
    rawUrl.match(/drive\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/);

  if (gdriveMatch) {
    const fileId = gdriveMatch[1];

    if (withPreview) {
      const filename = `${fileId}.jpg`;
      return { url: `https://drive.google.com/thumbnail?id=${fileId}`, filename, mime: "image/jpeg" };
    }

    if (!client) throw new Error("❌ client required for full-resolution Drive image");

    try {
      const { objectUrl, mime, filename: fetchedFilename } = await getDriveImageFull(client, fileId, DEBUG);

      if (DEBUG) console.log("🔹 MIME côté client:", mime);

      // Déduire l’extension depuis le MIME
      const extMap = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/x-png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
        "image/jp2": "jp2",
      };

      const ext = extMap[mime] || (fetchedFilename?.split(".").pop() ?? "bin");
      const filename = `${fileId}.${ext}`;

      return { url: objectUrl, filename, mime };
    } catch (e) {
      console.error("⚠️ Cannot access Google Drive full-resolution, fallback to preview");
      console.error(`Server error: ${formatServerError(e)}`);
      const filename = `${fileId}.jpg`;
      return { url: `https://drive.google.com/thumbnail?id=${fileId}`, filename, mime: "image/jpeg" };
    }
  }

  // Dropbox
  if (rawUrl.includes("dropbox.com")) {
    const url = rawUrl.replace(/\?dl=0$/, "?raw=1").replace(/\?dl=1$/, "?raw=1");
    const filename = rawUrl.split("/").pop().split("?")[0];
    return { url, filename, mime: "application/octet-stream" };
  }

  // Imgur
  const imgurMatch = rawUrl.match(/imgur\.com\/([a-zA-Z0-9]+)$/);
  if (imgurMatch) {
    const url = `https://i.imgur.com/${imgurMatch[1]}.jpg`;
    return { url, filename: `${imgurMatch[1]}.jpg`, mime: "image/jpeg" };
  }

  // URL directe
  if (rawUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|jp2)$/i)) {
    const filename = rawUrl.split("/").pop();
    return { url: rawUrl, filename, mime: "application/octet-stream" };
  }

  return { url: rawUrl, filename: rawUrl.split("/").pop(), mime: "application/octet-stream" };
}



function evictOldest() {
  if (!driveImageCache.size) return;
  let oldestKey = null;
  let oldestTs = Infinity;
  for (const [key, data] of driveImageCache.entries()) {
    if (data.ts < oldestTs) {
      oldestTs = data.ts;
      oldestKey = key;
    }
  }
  if (oldestKey) {
    try { URL.revokeObjectURL(driveImageCache.get(oldestKey).objectUrl); } catch (e) {}
    driveImageCache.delete(oldestKey);
  }
}

function cleanupCacheBySize() {
  while (driveImageCache.size > MAX_CACHE_SIZE) evictOldest();
}

function cleanupCache() {
  if (CACHE_TTL_MS) {
    const now = Date.now();
    for (const [key, data] of Array.from(driveImageCache.entries())) {
      if (now - data.ts > CACHE_TTL_MS) {
        try { URL.revokeObjectURL(data.objectUrl); } catch (e) {}
        driveImageCache.delete(key);
      }
    }
  }
  cleanupCacheBySize();
}

export function setMaxCacheSize(newSize) {
  if (!Number.isFinite(newSize) || newSize < 0) throw new Error("Invalid cache size");
  MAX_CACHE_SIZE = Math.floor(newSize);
  cleanupCache();
}

export function setCacheTTL(ms) {
  if (ms !== null && (!Number.isFinite(ms) || ms < 0)) throw new Error("Invalid TTL");
  CACHE_TTL_MS = ms === null ? null : Math.floor(ms);
  if (CACHE_TTL_MS !== null) cleanupCache();
}

export function startCacheAutoCleaner(intervalMs = 5 * 60 * 1000) {
  stopCacheAutoCleaner();
  autoCleanupIntervalId = setInterval(() => {
    try { cleanupCache(); } catch (e) { console.error("Cache cleanup error", e); }
  }, intervalMs);
  return autoCleanupIntervalId;
}

export function stopCacheAutoCleaner() {
  if (autoCleanupIntervalId) {
    clearInterval(autoCleanupIntervalId);
    autoCleanupIntervalId = null;
  }
}

export function getCacheStats() {
  let oldest = null;
  let newest = null;
  for (const data of driveImageCache.values()) {
    if (oldest === null || data.ts < oldest) oldest = data.ts;
    if (newest === null || data.ts > newest) newest = data.ts;
  }
  return {
    count: driveImageCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
    oldestTimestamp: oldest,
    newestTimestamp: newest
  };
}

export function clearDriveImageCache(file_id) {
  if (driveImageCache.has(file_id)) {
    try { URL.revokeObjectURL(driveImageCache.get(file_id).objectUrl); } catch (e) {}
    driveImageCache.delete(file_id);
  }
}

export function clearAllDriveImageCache() {
  for (const data of driveImageCache.values()) {
    try { URL.revokeObjectURL(data.objectUrl); } catch (e) {}
  }
  driveImageCache.clear();
}


/* ==============================
   Fonctions utilitaires d'images (preview, download, providers)
   ============================== */

/**
 * Transforme une URL brute en une URL utilisable pour aperçu image
 * Supporte Google Drive, Dropbox, Imgur, et URL directes classiques
 */
export function getPreviewUrl(url, { forceIframe = false } = {}) {
  if (!url) return null;
  url = url.trim();

  // --- Google Drive ---
  let match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return forceIframe
      ? `https://drive.google.com/file/d/${match[1]}/preview`
      : `https://drive.google.com/thumbnail?id=${match[1]}`;
  }

  match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return forceIframe
      ? `https://drive.google.com/file/d/${match[1]}/preview`
      : `https://drive.google.com/thumbnail?id=${match[1]}`;
  }

  // --- Dropbox ---
  match = url.match(/dropbox\.com\/.+/);
  if (match) {
    return url.replace(/\?dl=0$/, "?raw=1").replace(/\?dl=1$/, "?raw=1");
  }

  // --- Imgur ---
  match = url.match(/imgur\.com\/([a-zA-Z0-9]+)$/);
  if (match) return `https://i.imgur.com/${match[1]}.jpg`;

  // --- URL directe classique ---
  if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) return url;

  return url;
}

/**
 * Transforme une URL brute en URL de téléchargement
 */
export function getDownloadUrl(url) {
  if (!url) return null;
  url = url.trim();

  // Google Drive
  let match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;

  match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;

  // Dropbox
  match = url.match(/dropbox\.com\/.+/);
  if (match) return url.replace(/\?dl=0$/, "?raw=1").replace(/\?dl=1$/, "?raw=1");

  // Imgur
  match = url.match(/imgur\.com\/([a-zA-Z0-9]+)$/);
  if (match) return `https://i.imgur.com/${match[1]}.jpg`;

  // URL directe
  if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) return url;

  return url;
}


/**
 * Convertit une image distante en DataURL (base64)
 */
export async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Erreur conversion en base64:", err, "URL:", url);
    return null;
  }
}

/**
 * Normalise une URL d'image externe (Drive, Dropbox, Imgur…)
 */
export function normalizeImageUrl(rawUrl) {
  if (!rawUrl) return "";
  return rawUrl.trim();
}

/**
 * Récupère l'image en blob ou base64 (pleine résolution)
 * (compat: wrapper qui utilise getDriveImageFull)
 */
export async function fetchFullResImage(client, fileId) {
  return await getDriveImageFull(client, fileId, false);
}

/**
 * Extrait l'ID d'un fichier Google Drive depuis son URL
 */
export function extractDriveFileId(url) {
  let match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
           || url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}


export async function resizeImageToMaxSize(file, maxSizeKB = 300, maxWidth = 1024, maxHeight = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
      let { width, height } = img;

      // Redimensionner pour respecter maxWidth / maxHeight
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width *= ratio;
      height *= ratio;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Compression avec approche binaire pour accélérer
      let qualityMin = 0.1;
      let qualityMax = 0.9;
      let blob = null;

      for (let i = 0; i < 6; i++) { // max 6 essais
        const quality = (qualityMin + qualityMax) / 2;
        blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));

        if (blob.size / 1024 > maxSizeKB) {
          qualityMax = quality;
        } else {
          qualityMin = quality;
        }
      }

      resolve(blob);
      URL.revokeObjectURL(img.src);
    };

    img.onerror = reject;
  });
}


export function isInstagramUrl(url) {
  return url && /https?:\/\/(www\.)?instagram\.com\/([^\/]+\/)?p\/[A-Za-z0-9_-]+/.test(url);
}

 
export function createInstagramBlockquote(url) {
  const bq = document.createElement('blockquote');
  bq.className = 'instagram-media';

  // 🔹 Extraire le POST_ID quel que soit le username
  const match = url.match(/https:\/\/www\.instagram\.com\/(?:[^\/]+\/)?p\/([^\/]+)/);
  if (match) {
    const cleanUrl = `https://www.instagram.com/p/${match[1]}/`;
    console.log('URL brute', url, 'URL nettoyée', cleanUrl);
    bq.dataset.instgrmPermalink = cleanUrl;
  } else {
    console.warn('[createInstagramBlockquote] URL Instagram invalide :', url);
    bq.dataset.instgrmPermalink = url; // fallback
  }

  bq.dataset.instgrmVersion = '14';
  return bq;
}





/**
 * Afficher une image (URL ou Instagram)
 */
export async function displayImage(client, container, url, options = {}) {
    const { width = '100%', withPreview = true } = options; // <-- ajout withPreview
  container.innerHTML = '';

  // Placeholder
  const placeholder = document.createElement('img');
  placeholder.src = 'https://placehold.co/70x70?text=+';
  placeholder.style.width = width;
  placeholder.style.height = 'auto';
  placeholder.style.objectFit = 'cover';
  container.appendChild(placeholder);

  if (!url) return;

  try {
    // Instagram
    if (isInstagramUrl(url)) {
      container.innerHTML = '';
      const bq = createInstagramBlockquote(url);
      bq.classList.add('photo-instagram-preview');

      const wrapper = document.createElement('div');
      wrapper.style.width = width;
      wrapper.style.height = 'auto';
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

    // Image normale
      const { url: displayUrl } = await getDisplayableImageUrl(url, { client, withPreview });
    if (displayUrl) {
      container.innerHTML = '';
      const imgEl = document.createElement('img');
      imgEl.src = displayUrl;
      imgEl.style.width = width;   // largeur paramétrable
      imgEl.style.height = 'auto'; // conserve le ratio
      imgEl.style.objectFit = 'contain';
      container.appendChild(imgEl);

      const linkWrapper = document.createElement('a');
      linkWrapper.target = '_blank';
      container.replaceChild(linkWrapper, imgEl);
      linkWrapper.appendChild(imgEl);
    }

  } catch (err) {
    console.error('[displayImage] Erreur :', err);
    container.innerHTML = '';
    container.appendChild(placeholder);
  }
}
