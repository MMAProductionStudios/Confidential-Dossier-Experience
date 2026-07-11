/**
 * reproductor.js — Módulo del Reproductor de Audio
 * ─────────────────────────────────────────────────────────────────────────────
 * REPRODUCTOR INSTITUCIONAL DE EVIDENCIAS — EXPEDIENTE CSC-2026-MB
 *
 * Gestiona la reproducción de audio HTML5 con soporte para URLs de
 * Google Drive y otras fuentes externas. El módulo garantiza que
 * solo un reproductor esté activo a la vez.
 *
 * CONFIGURACIÓN DE GOOGLE DRIVE:
 *   Las URLs de Google Drive deben estar en formato de vista previa:
 *   https://drive.google.com/file/d/FILE_ID/view
 *
 *   El módulo las convierte automáticamente al formato de streaming:
 *   https://drive.google.com/uc?export=download&id=FILE_ID
 *
 *   IMPORTANTE: El archivo en Google Drive debe ser compartido como
 *   "Cualquier persona con el enlace puede ver".
 *
 *   ALTERNATIVA: Use uc?export=preview para streaming sin descarga:
 *   https://docs.google.com/uc?export=open&id=FILE_ID
 * ─────────────────────────────────────────────────────────────────────────────
 */


// ── Estado del reproductor ───────────────────────────────────────────────────

/**
 * Referencia al elemento <audio> actualmente activo.
 * Se usa para detener reproducción previa al abrir otra evidencia.
 * @type {HTMLAudioElement|null}
 */
let reproductorActivo = null;


/**
 * Convierte una URL de Google Drive al formato compatible con HTML5 Audio.
 *
 * Soporta los siguientes formatos de entrada:
 *   - https://drive.google.com/file/d/FILE_ID/view
 *   - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   - https://drive.google.com/open?id=FILE_ID
 *
 * @param {string} url - URL original de Google Drive
 * @returns {string} — URL en formato de streaming directo
 */
export function convertirUrlGoogleDrive(url) {
  if (!url || typeof url !== 'string') return url;

  // Verificar si es una URL de Google Drive
  if (!url.includes('drive.google.com')) return url;

  // Extraer FILE_ID de formato /file/d/FILE_ID/
  const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile) {
    const fileId = matchFile[1];
    // Usar el endpoint de preview para streaming sin forzar descarga
    return `https://drive.google.com/uc?export=open&id=${fileId}`;
  }

  // Extraer FILE_ID de formato open?id=FILE_ID
  const matchOpen = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchOpen) {
    const fileId = matchOpen[1];
    return `https://drive.google.com/uc?export=open&id=${fileId}`;
  }

  // Si no se reconoce el formato, devolver la URL original
  return url;
}


/**
 * Crea y renderiza un reproductor de audio HTML5 para una evidencia.
 *
 * @param {Object} cancion   - Objeto canción de canciones.json
 * @param {string} cancion.audio - URL del archivo de audio
 * @param {string} cancion.titulo - Título de la pieza
 * @returns {HTMLElement} — Elemento DOM del reproductor listo para insertar
 */
export function crearReproductor(cancion) {
  const contenedor = document.createElement('div');
  contenedor.className = 'reproductor';

  const label = document.createElement('p');
  label.className   = 'reproductor__label';
  label.textContent = 'ARCHIVO DE AUDIO — EVIDENCIA SONORA';
  contenedor.appendChild(label);

  // Verificar si hay URL de audio disponible
  if (!cancion.audio || cancion.audio.trim() === '') {
    // Mostrar mensaje de que el audio no está disponible aún
    const noAudio = document.createElement('div');
    noAudio.className = 'reproductor__no-audio';
    noAudio.innerHTML = `
      <span>⚠</span>
      <span>ARCHIVO DE AUDIO PENDIENTE DE ASIGNACIÓN. LA URL DEL ARCHIVO SE CONFIGURA EN data/canciones.json</span>
    `;
    contenedor.appendChild(noAudio);
    return contenedor;
  }

  // Convertir URL de Google Drive si aplica
  const urlAudio = convertirUrlGoogleDrive(cancion.audio);

  // Crear elemento <audio> nativo
  const audio = document.createElement('audio');
  audio.className = 'reproductor__audio';
  audio.controls  = true;
  audio.preload   = 'metadata'; // Cargar solo metadatos, no el archivo completo

  // Configurar la fuente de audio
  const source = document.createElement('source');
  source.src  = urlAudio;
  source.type = determinarTipoAudio(urlAudio);
  audio.appendChild(source);

  // Mensaje de fallback para navegadores sin soporte
  const fallbackText = document.createTextNode(
    'SU NAVEGADOR NO SOPORTA EL REPRODUCTOR DE AUDIO HTML5.'
  );
  audio.appendChild(fallbackText);

  // Evento: detener otros reproductores al reproducir este
  audio.addEventListener('play', () => {
    detenerReproductorPrevio(audio);
  });

  // Evento: manejar errores de carga del audio
  audio.addEventListener('error', () => {
    contenedor.innerHTML = '';
    contenedor.innerHTML = `
      <p class="reproductor__label">ARCHIVO DE AUDIO</p>
      <div class="reproductor__no-audio">
        <span>⚠</span>
        <span>NO SE PUDO CARGAR EL ARCHIVO DE AUDIO. VERIFIQUE LA URL EN data/canciones.json Y LOS PERMISOS DE COMPARTICIÓN.</span>
      </div>
    `;
  });

  contenedor.appendChild(audio);
  return contenedor;
}


/**
 * Detiene el reproductor activo previo y registra el nuevo como activo.
 *
 * @param {HTMLAudioElement} nuevoAudio - El nuevo reproductor que inicia
 */
function detenerReproductorPrevio(nuevoAudio) {
  if (reproductorActivo && reproductorActivo !== nuevoAudio) {
    reproductorActivo.pause();
    reproductorActivo.currentTime = 0;
  }
  reproductorActivo = nuevoAudio;
}


/**
 * Determina el tipo MIME del archivo de audio según la URL.
 * Necesario para el atributo `type` del elemento <source>.
 *
 * @param {string} url - URL del archivo de audio
 * @returns {string} — Tipo MIME (ej: 'audio/mpeg', 'audio/ogg')
 */
function determinarTipoAudio(url) {
  if (!url) return 'audio/mpeg';

  const urlLower = url.toLowerCase();

  if (urlLower.includes('.mp3'))  return 'audio/mpeg';
  if (urlLower.includes('.ogg'))  return 'audio/ogg';
  if (urlLower.includes('.wav'))  return 'audio/wav';
  if (urlLower.includes('.m4a'))  return 'audio/mp4';
  if (urlLower.includes('.aac'))  return 'audio/aac';
  if (urlLower.includes('.flac')) return 'audio/flac';

  // Para Google Drive y URLs sin extensión, asumir MP3
  if (url.includes('drive.google.com')) return 'audio/mpeg';

  return 'audio/mpeg';
}


/**
 * Detiene todos los reproductores activos en la página.
 * Se llama al cerrar el expediente o cerrar sesión.
 */
export function detenerTodosReproductores() {
  document.querySelectorAll('audio').forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  reproductorActivo = null;
}
