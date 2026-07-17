/**
 * reproductor.js — Módulo del Reproductor de Audio
 * ─────────────────────────────────────────────────────────────────────────────
 * REPRODUCTOR INSTITUCIONAL DE EVIDENCIAS — EXPEDIENTE CSC-2026-MB
 *
 * Funcionalidades:
 *   - Player HTML5 personalizado con barra de progreso interactiva
 *   - Líricas sincronizadas via timeupdate (formato {t, texto})
 *   - Notas de producción que aparecen en segundos específicos
 *   - Botón de reacción ♡ con registro de timestamp
 *   - Calificación por canción (1–10) con persistencia en safeStorage
 *   - Panel de tabs colapsable: Historia / Líricas / Ficha Técnica
 *   - Soporte YouTube (iframe), Google Drive y MP3 directo
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { safeStorage } from './ui.js';
import { registrarReaccion, registrarCalificacionCancion } from './db.js';

let reproductorActivo = null;


// ── Detección de fuente ───────────────────────────────────────────────────────

function extraerIdYoutube(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) return null;
  const patrones = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patrones) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function convertirUrlGoogleDrive(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('drive.google.com')) return url;
  const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile) return `https://drive.google.com/uc?export=open&id=${matchFile[1]}`;
  const matchOpen = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchOpen) return `https://drive.google.com/uc?export=open&id=${matchOpen[1]}`;
  return url;
}

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

function formatTiempo(seg) {
  if (!isFinite(seg) || seg < 0) return '0:00';
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}


// ── Fábrica principal ─────────────────────────────────────────────────────────

/**
 * Crea y renderiza un reproductor completo para una evidencia.
 * Incluye player, líricas sincronizadas, notas de producción,
 * reacción, calificación y panel de tabs.
 *
 * @param {Object} cancion - Objeto canción con audio, lirica, notas_produccion, etc.
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
  let audioEl = null;

  if (!url) {
    contenedor.appendChild(crearMensajePendiente());
  } else {
    const youtubeId = extraerIdYoutube(url);
    if (youtubeId) {
      contenedor.appendChild(crearEmbedYoutube(youtubeId));
    } else {
      const urlFinal = convertirUrlGoogleDrive(url);
      const resultado = crearPlayerCustom(cancion, urlFinal);
      audioEl = resultado.audioEl;
      contenedor.appendChild(resultado.playerEl);
    }
  }

  contenedor.appendChild(crearPanelTabs(cancion, audioEl));

  return contenedor;
}


// ── Player HTML5 personalizado ────────────────────────────────────────────────

function crearPlayerCustom(cancion, urlFinal) {
  const playerEl = document.createElement('div');
  playerEl.className = 'rep-player';

  const audioEl = document.createElement('audio');
  audioEl.preload = 'metadata';
  const source = document.createElement('source');
  source.src  = urlFinal;
  source.type = determinarTipoAudio(urlFinal);
  audioEl.appendChild(source);
  playerEl.appendChild(audioEl);

  // ── Fila de controles: Play | Tiempo | Reacción ───────────────────────────
  const ctrlRow = document.createElement('div');
  ctrlRow.className = 'rep-controls';

  const btnPlay = document.createElement('button');
  btnPlay.type      = 'button';
  btnPlay.className = 'rep-btn-play';
  btnPlay.setAttribute('aria-label', 'Reproducir');
  btnPlay.innerHTML = '&#9654;';

  const timeDisplay = document.createElement('span');
  timeDisplay.className   = 'rep-time';
  timeDisplay.textContent = '0:00 / 0:00';

  const btnReaction = document.createElement('button');
  btnReaction.type = 'button';
  btnReaction.className = 'rep-btn-reaction';
  btnReaction.title = 'Marcar este momento';
  btnReaction.setAttribute('aria-label', 'Me gusta este momento');
  btnReaction.textContent = '♡';

  ctrlRow.appendChild(btnPlay);
  ctrlRow.appendChild(timeDisplay);
  ctrlRow.appendChild(btnReaction);
  playerEl.appendChild(ctrlRow);

  // ── Barra de progreso ─────────────────────────────────────────────────────
  const progressWrap = document.createElement('div');
  progressWrap.className = 'rep-progress-wrap';

  const progressBar = document.createElement('div');
  progressBar.className = 'rep-progress-bar';
  progressBar.setAttribute('role', 'slider');
  progressBar.setAttribute('aria-label', 'Posición de reproducción');
  progressBar.setAttribute('tabindex', '0');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');
  progressBar.setAttribute('aria-valuenow', '0');

  const progressFill = document.createElement('div');
  progressFill.className = 'rep-progress-fill';

  const progressThumb = document.createElement('div');
  progressThumb.className = 'rep-progress-thumb';

  progressBar.appendChild(progressFill);
  progressBar.appendChild(progressThumb);
  progressWrap.appendChild(progressBar);

  // Nota de producción (aparece encima de la barra en momentos específicos)
  const notaOverlay = document.createElement('div');
  notaOverlay.className = 'rep-nota-overlay';
  notaOverlay.setAttribute('aria-live', 'polite');
  notaOverlay.hidden = true;
  progressWrap.appendChild(notaOverlay);

  playerEl.appendChild(progressWrap);

  // ── Calificación por canción ──────────────────────────────────────────────
  playerEl.appendChild(crearRatingCancion(cancion.id));

  // ── Listeners ─────────────────────────────────────────────────────────────

  btnPlay.addEventListener('click', () => {
    if (audioEl.paused) {
      if (reproductorActivo && reproductorActivo !== audioEl) {
        reproductorActivo.pause();
      }
      audioEl.play().catch(() => {});
      reproductorActivo = audioEl;
    } else {
      audioEl.pause();
    }
  });

  audioEl.addEventListener('play',  () => { btnPlay.innerHTML = '&#9646;&#9646;'; btnPlay.setAttribute('aria-label', 'Pausar'); });
  audioEl.addEventListener('pause', () => { btnPlay.innerHTML = '&#9654;'; btnPlay.setAttribute('aria-label', 'Reproducir'); });
  audioEl.addEventListener('ended', () => {
    btnPlay.innerHTML = '&#9654;';
    progressFill.style.width = '0%';
    progressThumb.style.left = '0%';
  });
  audioEl.addEventListener('error', () => {
    playerEl.innerHTML = '';
    playerEl.appendChild(crearMensajeError());
  });

  // timeupdate — progreso + notas de producción
  const notas = Array.isArray(cancion.notas_produccion) ? cancion.notas_produccion : [];
  let notaActivaIdx = -1;

  audioEl.addEventListener('timeupdate', () => {
    const ct  = audioEl.currentTime;
    const dur = audioEl.duration || 0;
    const pct = dur > 0 ? (ct / dur) * 100 : 0;

    progressFill.style.width = `${pct}%`;
    progressThumb.style.left = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', Math.round(pct));
    timeDisplay.textContent = `${formatTiempo(ct)} / ${formatTiempo(dur)}`;

    let foundIdx = -1;
    for (let i = 0; i < notas.length; i++) {
      const diff = ct - notas[i].t;
      if (diff >= 0 && diff < (notas[i].duracion || 5)) { foundIdx = i; break; }
    }
    if (foundIdx !== notaActivaIdx) {
      notaActivaIdx = foundIdx;
      if (foundIdx >= 0) {
        notaOverlay.textContent = notas[foundIdx].nota;
        notaOverlay.hidden = false;
      } else {
        notaOverlay.hidden = true;
      }
    }
  });

  // Clic en barra de progreso (seek) + arrastrar
  let isDragging = false;

  function seekFromEvent(e) {
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
  }

  progressBar.addEventListener('click',     seekFromEvent);
  progressBar.addEventListener('mousedown', (e) => { isDragging = true; seekFromEvent(e); });
  document.addEventListener('mousemove',    (e) => { if (isDragging) seekFromEvent(e); });
  document.addEventListener('mouseup',      ()  => { isDragging = false; });
  progressBar.addEventListener('touchstart', seekFromEvent, { passive: true });
  progressBar.addEventListener('touchmove',  seekFromEvent, { passive: true });

  progressBar.addEventListener('keydown', (e) => {
    if (!audioEl.duration) return;
    if (e.key === 'ArrowRight') audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5);
    if (e.key === 'ArrowLeft')  audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
  });

  // Botón de reacción
  btnReaction.addEventListener('click', async () => {
    const ts = Math.round(audioEl.currentTime);
    btnReaction.textContent = '♥';
    btnReaction.classList.add('reaccionado');
    setTimeout(() => {
      btnReaction.textContent = '♡';
      btnReaction.classList.remove('reaccionado');
    }, 1500);
    try { await registrarReaccion(cancion.id, ts); } catch (_) {}
  });

  return { playerEl, audioEl };
}


// ── Calificación por canción (1–10) ──────────────────────────────────────────

function crearRatingCancion(cancionId) {
  const wrap = document.createElement('div');
  wrap.className = 'rep-rating';

  const label = document.createElement('span');
  label.className   = 'rep-rating__label';
  label.textContent = 'CALIFICAR ESTA PIEZA:';
  wrap.appendChild(label);

  const nums = document.createElement('div');
  nums.className = 'rep-rating__nums';

  const savedVal = parseInt(safeStorage.getItem(`rating_${cancionId}`) || '0', 10);

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.type          = 'button';
    btn.className     = 'rep-rating__num' + (savedVal === i ? ' seleccionado' : '');
    btn.textContent   = String(i);
    btn.dataset.valor = String(i);

    btn.addEventListener('click', () => {
      nums.querySelectorAll('.rep-rating__num').forEach(b => b.classList.remove('seleccionado'));
      btn.classList.add('seleccionado');
      safeStorage.setItem(`rating_${cancionId}`, String(i));
      registrarCalificacionCancion(cancionId, i).catch(() => {});
    });

    nums.appendChild(btn);
  }

  wrap.appendChild(nums);
  return wrap;
}


// ── Panel de Tabs: Historia / Líricas / Ficha Técnica ────────────────────────

function crearPanelTabs(cancion, audioEl) {
  const panel = document.createElement('div');
  panel.className = 'rep-tabs';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'rep-tabs__toggle';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.innerHTML = '<span class="rep-tabs__icono">▼</span> HISTORIAL DE LA EVIDENCIA';

  const body = document.createElement('div');
  body.className = 'rep-tabs__body';

  const nav = document.createElement('div');
  nav.className = 'rep-tabs__nav';
  nav.setAttribute('role', 'tablist');

  const TAB_DEFS = [
    { id: 'historia', label: 'LA HISTORIA' },
    { id: 'lirica',   label: 'LÍRICAS' },
    { id: 'creditos', label: 'FICHA TÉCNICA' },
  ];

  const contentMap = {};

  TAB_DEFS.forEach((def, idx) => {
    const tabBtn = document.createElement('button');
    tabBtn.type      = 'button';
    tabBtn.className = 'rep-tabs__tab' + (idx === 0 ? ' activo' : '');
    tabBtn.dataset.tab = def.id;
    tabBtn.textContent = def.label;
    tabBtn.setAttribute('role', 'tab');
    tabBtn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    nav.appendChild(tabBtn);

    const content = document.createElement('div');
    content.className  = 'rep-tab-content';
    content.dataset.tab = def.id;
    content.setAttribute('role', 'tabpanel');
    content.hidden = idx !== 0;
    contentMap[def.id] = content;
  });

  // Historia
  const historiaEl = document.createElement('p');
  historiaEl.className   = 'rep-tab-texto';
  historiaEl.textContent = cancion.historia || 'SIN INFORMACIÓN DISPONIBLE.';
  contentMap['historia'].appendChild(historiaEl);

  // Líricas (sincronizadas si hay campo lirica, fallback a letra)
  contentMap['lirica'].appendChild(crearContenedorLirica(cancion, audioEl));

  // Ficha Técnica
  const creditosEl = document.createElement('pre');
  creditosEl.className   = 'rep-tab-texto rep-tab-texto--creditos';
  creditosEl.textContent = cancion.creditos || 'SIN CRÉDITOS DISPONIBLES.';
  contentMap['creditos'].appendChild(creditosEl);

  // Cambio de tab
  nav.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.rep-tabs__tab');
    if (!tabBtn) return;
    const tabId = tabBtn.dataset.tab;
    nav.querySelectorAll('.rep-tabs__tab').forEach(b => {
      const active = b.dataset.tab === tabId;
      b.classList.toggle('activo', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    Object.entries(contentMap).forEach(([id, el]) => { el.hidden = id !== tabId; });
  });

  body.appendChild(nav);
  Object.values(contentMap).forEach(c => body.appendChild(c));

  // Colapsar/expandir panel
  toggle.addEventListener('click', () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    const icono = toggle.querySelector('.rep-tabs__icono');
    if (icono) icono.textContent = open ? '▶' : '▼';
  });

  panel.appendChild(toggle);
  panel.appendChild(body);
  return panel;
}


// ── Líricas sincronizadas (karaoke) ─────────────────────────────────────────

/**
 * Construye el contenedor de líricas.
 * Si la canción tiene campo `lirica` (array de {t, texto}), sincroniza con el audio.
 * Si no, muestra el campo `letra` como texto plano.
 *
 * Formato de cancion.lirica:
 *   [ { "t": 0, "texto": "Primera línea" }, { "t": 4.5, "texto": "Segunda línea" }, ... ]
 */
function crearContenedorLirica(cancion, audioEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'rep-lirica-wrap';

  const lineas = cancion.lirica;

  if (!Array.isArray(lineas) || lineas.length === 0) {
    const pre = document.createElement('pre');
    pre.className   = 'rep-tab-texto rep-tab-texto--letra';
    pre.textContent = cancion.letra || 'SIN LETRA DISPONIBLE.';
    wrapper.appendChild(pre);
    return wrapper;
  }

  const lyricsEl = document.createElement('div');
  lyricsEl.className = 'rep-lirica';

  const lineEls = lineas.map(linea => {
    const el = document.createElement('div');
    el.className   = 'rep-lirica__linea';
    el.textContent = linea.texto;
    lyricsEl.appendChild(el);
    return { el, t: Number(linea.t) };
  });

  wrapper.appendChild(lyricsEl);

  if (audioEl) {
    let lastActive = -1;
    audioEl.addEventListener('timeupdate', () => {
      const ct = audioEl.currentTime;
      let activeIdx = -1;
      for (let i = lineEls.length - 1; i >= 0; i--) {
        if (ct >= lineEls[i].t) { activeIdx = i; break; }
      }
      if (activeIdx !== lastActive) {
        lastActive = activeIdx;
        lineEls.forEach((l, idx) => l.el.classList.toggle('activa', idx === activeIdx));
        if (activeIdx >= 0) {
          lineEls[activeIdx].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    audioEl.addEventListener('seeked', () => { lastActive = -1; });
  }

  return wrapper;
}


// ── Helpers privados ──────────────────────────────────────────────────────────

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
  el.innerHTML = `<span>⚠</span><span>ARCHIVO DE AUDIO PENDIENTE. AGREGUE LA URL EN data/canciones.json</span>`;
  return el;
}

function crearMensajeError() {
  const el = document.createElement('div');
  el.className = 'reproductor__no-audio';
  el.innerHTML = `<span>⚠</span><span>NO SE PUDO CARGAR EL AUDIO. VERIFIQUE LA URL Y LOS PERMISOS.</span>`;
  return el;
}


/**
 * Detiene todos los reproductores activos en la página.
 */
export function detenerTodosReproductores() {
  document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
  reproductorActivo = null;
}
