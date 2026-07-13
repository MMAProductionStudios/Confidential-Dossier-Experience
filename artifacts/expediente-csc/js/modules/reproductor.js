/**
 * reproductor.js — Módulo del Reproductor de Audio
 * ─────────────────────────────────────────────────────────────────────────────
 * REPRODUCTOR INSTITUCIONAL DE EVIDENCIAS — EXPEDIENTE CSC-2026-MB
 *
 * Soporta:
 *   - YouTube  (youtube.com/watch?v=ID  o  youtu.be/ID)
 *   - Google Drive  (drive.google.com/file/d/ID/view)
 *   - MP3 / OGG / WAV / M4A directos
 *
 * Para YouTube: el archivo debe estar público o sin restricción de embedding.
 * Para Google Drive: compartir como "Cualquier persona con el enlace puede ver".
 * ─────────────────────────────────────────────────────────────────────────────
 */


let reproductorActivo = null;


// ── Detección de fuente ───────────────────────────────────────────────────────

/**
 * Detecta si la URL es de YouTube.
 * Soporta: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 *
 * @param {string} url
 * @returns {string|null} — El ID de YouTube, o null si no es YouTube
 */
function extraerIdYoutube(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) return null;

  const patrones = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const patron of patrones) {
    const m = url.match(patron);
    if (m) return m[1];
  }
  return null;
}


/**
 * Convierte una URL de Google Drive al formato compatible con HTML5 Audio.
 *
 * @param {string} url
 * @returns {string}
 */
export function convertirUrlGoogleDrive(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('drive.google.com')) return url;

  const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile) {
    return `https://drive.google.com/uc?export=open&id=${matchFile[1]}`;
  }

  const matchOpen = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchOpen) {
    return `https://drive.google.com/uc?export=open&id=${matchOpen[1]}`;
  }

  return url;
}


/**
 * Determina el tipo MIME del archivo de audio según la URL.
 *
 * @param {string} url
 * @returns {string}
 */
function determinarTipoAudio(url) {
  if (!url) return 'audio/mpeg';
  const u = url.toLowerCase();
  if (u.includes('.mp3'))  return 'audio/mpeg';
  if (u.includes('.ogg'))  return 'audio/ogg';
  if (u.includes('.wav'))  return 'audio/wav';
  if (u.includes('.m4a'))  return 'audio/mp4';
  if (u.includes('.aac'))  return 'audio/aac';
  if (u.includes('.flac')) return 'audio/flac';
  return 'audio/mpeg';
}


// ── Fábrica de reproductores ──────────────────────────────────────────────────

/**
 * Crea y renderiza un reproductor de audio/video para una evidencia.
 * Detecta automáticamente YouTube, Google Drive o MP3 directo.
 *
 * @param {Object} cancion - Objeto canción de canciones.json
 * @returns {HTMLElement}
 */
export function crearReproductor(cancion) {
  const contenedor = document.createElement('div');
  contenedor.className = 'reproductor';

  const label = document.createElement('p');
  label.className   = 'reproductor__label';
  label.textContent = 'ARCHIVO DE AUDIO — EVIDENCIA SONORA';
  contenedor.appendChild(label);

  const url = (cancion.audio || '').trim();

  if (!url) {
    contenedor.appendChild(crearMensajePendiente());
    return contenedor;
  }

  // ── YouTube ────────────────────────────────────────────────────────────────
  const youtubeId = extraerIdYoutube(url);
  if (youtubeId) {
    contenedor.appendChild(crearEmbedYoutube(youtubeId));
    return contenedor;
  }

  // ── Google Drive / MP3 directo ─────────────────────────────────────────────
  const urlFinal = convertirUrlGoogleDrive(url);
  const audio    = document.createElement('audio');
  audio.className = 'reproductor__audio';
  audio.controls  = true;
  audio.preload   = 'metadata';

  const source = document.createElement('source');
  source.src  = urlFinal;
  source.type = determinarTipoAudio(urlFinal);
  audio.appendChild(source);

  audio.addEventListener('play', () => {
    if (reproductorActivo && reproductorActivo !== audio) {
      reproductorActivo.pause();
      reproductorActivo.currentTime = 0;
    }
    reproductorActivo = audio;
  });

  audio.addEventListener('error', () => {
    contenedor.innerHTML = '';
    const lbl2 = document.createElement('p');
    lbl2.className   = 'reproductor__label';
    lbl2.textContent = 'ARCHIVO DE AUDIO';
    contenedor.appendChild(lbl2);
    contenedor.appendChild(crearMensajeError());
  });

  contenedor.appendChild(audio);
  return contenedor;
}


// ── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Crea un iframe de embed para YouTube.
 *
 * @param {string} videoId
 * @returns {HTMLElement}
 */
function crearEmbedYoutube(videoId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'reproductor__youtube';

  const iframe = document.createElement('iframe');
  iframe.src             = `https://www.youtube.com/embed/${videoId}`;
  iframe.title           = 'Reproductor de audio YouTube';
  iframe.allow           = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.loading         = 'lazy';
  iframe.style.cssText   = 'width:100%; height:80px; border:none;';

  wrapper.appendChild(iframe);
  return wrapper;
}

function crearMensajePendiente() {
  const el = document.createElement('div');
  el.className = 'reproductor__no-audio';
  el.innerHTML = `<span>⚠</span><span>ARCHIVO DE AUDIO PENDIENTE. AGREGUE LA URL EN data/canciones.json (SOPORTA YOUTUBE, GOOGLE DRIVE O MP3 DIRECTO)</span>`;
  return el;
}

function crearMensajeError() {
  const el = document.createElement('div');
  el.className = 'reproductor__no-audio';
  el.innerHTML = `<span>⚠</span><span>NO SE PUDO CARGAR EL AUDIO. VERIFIQUE LA URL Y LOS PERMISOS DE COMPARTICIÓN.</span>`;
  return el;
}


/**
 * Detiene todos los reproductores activos en la página.
 */
export function detenerTodosReproductores() {
  document.querySelectorAll('audio').forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  reproductorActivo = null;
}
