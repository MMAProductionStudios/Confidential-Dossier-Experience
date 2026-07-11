/**
 * expediente.js — Módulo del Expediente
 * ─────────────────────────────────────────────────────────────────────────────
 * PANTALLA PRINCIPAL DEL EXPEDIENTE — EXPEDIENTE CSC-2026-MB
 *
 * Gestiona la pantalla principal del expediente:
 *   - Renderiza las evidencias (canciones) como tarjetas expandibles
 *   - Muestra el reproductor de audio por cada evidencia
 *   - Gestiona las pestañas de contenido (Historia, Letra, Créditos)
 *   - Puebla los datos del evaluador en la portada del expediente
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { obtenerCanciones } from './db.js';
import { crearReproductor, detenerTodosReproductores } from './reproductor.js';
import { cerrarSesion } from './auth.js';
import {
  mostrarPantalla,
  SCREENS,
  formatearFechaInstitucional,
  formatearFechaLarga,
  setText
} from './ui.js';


/**
 * Inicializa el módulo del expediente.
 * Registra listeners para el botón de cerrar sesión.
 */
export function initExpediente() {
  const btnCerrar = document.getElementById('btn-cerrar-sesion');

  if (btnCerrar) {
    btnCerrar.addEventListener('click', () => {
      detenerTodosReproductores();
      cerrarSesion();
      mostrarPantalla(SCREENS.INICIO);
    });
  }
}


/**
 * Renderiza la pantalla completa del expediente para un usuario dado.
 * Carga las evidencias desde la base de datos y las dibuja en el DOM.
 *
 * @param {Object} usuario - Objeto del usuario autenticado
 * @param {string} idSesion - ID de sesión generado por el módulo de credencial
 */
export async function renderizarExpediente(usuario, idSesion) {

  // ── Poblar datos del evaluador en la portada ───────────────────────────────
  setText('exp-nombre-evaluador', usuario.nombre || '—');
  setText('exp-fecha-acceso',     formatearFechaInstitucional(new Date()));
  setText('exp-footer-evaluador', `EVALUADOR: ${usuario.nombre || '—'}`);
  setText('exp-footer-fecha',     formatearFechaLarga());

  // ── Mostrar la pantalla del expediente ────────────────────────────────────
  mostrarPantalla(SCREENS.EXPEDIENTE);

  // ── Cargar evidencias (canciones) desde la base de datos ─────────────────
  try {
    const canciones = await obtenerCanciones();
    renderizarEvidencias(canciones);
  } catch (error) {
    console.error('[Expediente] Error cargando evidencias:', error);
    const lista = document.getElementById('evidencias-lista');
    if (lista) {
      lista.innerHTML = `
        <div class="error-global">
          ERROR DEL SISTEMA. NO SE PUDIERON CARGAR LAS EVIDENCIAS.
          VERIFIQUE LA RUTA DEL ARCHIVO data/canciones.json.
        </div>
      `;
    }
  }
}


/**
 * Renderiza todas las evidencias en el contenedor #evidencias-lista.
 * Cada canción se convierte en una tarjeta expandible con reproductor.
 *
 * @param {Array} canciones - Array de objetos canción de canciones.json
 */
function renderizarEvidencias(canciones) {
  const lista    = document.getElementById('evidencias-lista');
  const cargando = document.getElementById('evidencias-cargando');

  // Ocultar indicador de carga
  if (cargando) cargando.style.display = 'none';

  if (!lista) return;

  if (!canciones || canciones.length === 0) {
    lista.innerHTML = `
      <div class="instruccion-operativa">
        <p>NO SE ENCONTRARON EVIDENCIAS EN EL EXPEDIENTE.</p>
        <p>VERIFIQUE EL ARCHIVO data/canciones.json.</p>
      </div>
    `;
    return;
  }

  // Construir tarjeta por cada canción
  canciones.forEach((cancion, indice) => {
    const tarjeta = crearTarjetaEvidencia(cancion, indice + 1);
    lista.appendChild(tarjeta);
  });
}


/**
 * Crea el elemento DOM de una tarjeta de evidencia expandible.
 *
 * Estructura:
 *   .evidencia
 *     .evidencia__header       (siempre visible, clic para expandir)
 *     .evidencia__contenido    (oculto por defecto, se expande al abrir)
 *       [tabs: Reproductor | Historia | Letra | Créditos]
 *
 * @param {Object} cancion - Objeto canción de canciones.json
 * @param {number} numero  - Número de evidencia (1, 2, 3...)
 * @returns {HTMLElement} — Elemento DOM de la evidencia
 */
function crearTarjetaEvidencia(cancion, numero) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'evidencia';
  tarjeta.id        = `evidencia-${cancion.id}`;

  // Número de evidencia formateado con ceros
  const numFormato = String(numero).padStart(2, '0');

  // ── Encabezado (siempre visible) ─────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'evidencia__header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-label', `Evidencia ${numFormato}: ${cancion.titulo}`);

  header.innerHTML = `
    <span class="evidencia__numero">EVIDENCIA ${numFormato}</span>
    <span class="evidencia__nombre">${cancion.titulo}</span>
    <span class="evidencia__estado">Disponible para consulta</span>
    <button class="evidencia__toggle" type="button" aria-label="Abrir evidencia ${numFormato}">
      ABRIR EVIDENCIA
    </button>
  `;

  // ── Contenido expandible ──────────────────────────────────────────────────
  const contenido = document.createElement('div');
  contenido.className = 'evidencia__contenido';
  contenido.setAttribute('role', 'region');
  contenido.setAttribute('aria-label', `Contenido de la evidencia ${numFormato}`);

  // Subtítulo de la evidencia
  if (cancion.subtitulo) {
    const subtitulo = document.createElement('p');
    subtitulo.style.cssText = `
      font-size: var(--texto-xs);
      letter-spacing: 0.1em;
      color: var(--color-acento);
      text-transform: uppercase;
      margin-bottom: var(--espacio-4);
    `;
    subtitulo.textContent = cancion.subtitulo;
    contenido.appendChild(subtitulo);
  }

  // Pestañas de contenido
  const tabs       = crearTabs(cancion.id);
  const panelRepro = crearPanelReproductor(cancion);
  const panelHist  = crearPanelTexto(cancion.historia, 'Historia de la pieza');
  const panelLetra = crearPanelLetra(cancion.letra);
  const panelCred  = crearPanelCreditos(cancion.creditos);

  contenido.appendChild(tabs.contenedorTabs);
  contenido.appendChild(panelRepro);
  contenido.appendChild(panelHist);
  contenido.appendChild(panelLetra);
  contenido.appendChild(panelCred);

  // ── Eventos de apertura/cierre ────────────────────────────────────────────
  const toggleBtn = header.querySelector('.evidencia__toggle');
  const abrirCerrar = () => alternarEvidencia(tarjeta, header, toggleBtn);

  header.addEventListener('click', abrirCerrar);

  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirCerrar();
    }
  });

  // ── Activar primera pestaña por defecto ───────────────────────────────────
  activarTab(tabs.tabReproductor, panelRepro, [
    { tab: tabs.tabReproductor, panel: panelRepro },
    { tab: tabs.tabHistoria,    panel: panelHist  },
    { tab: tabs.tabLetra,       panel: panelLetra },
    { tab: tabs.tabCreditos,    panel: panelCred  }
  ]);

  // ── Registrar listeners de las pestañas ───────────────────────────────────
  const grupos = [
    { tab: tabs.tabReproductor, panel: panelRepro },
    { tab: tabs.tabHistoria,    panel: panelHist  },
    { tab: tabs.tabLetra,       panel: panelLetra },
    { tab: tabs.tabCreditos,    panel: panelCred  }
  ];

  grupos.forEach(({ tab, panel }) => {
    tab.addEventListener('click', () => activarTab(tab, panel, grupos));
  });

  tarjeta.appendChild(header);
  tarjeta.appendChild(contenido);

  return tarjeta;
}


/**
 * Alterna el estado de apertura/cierre de una evidencia.
 *
 * @param {HTMLElement} tarjeta   - Elemento .evidencia
 * @param {HTMLElement} header    - Encabezado de la tarjeta
 * @param {HTMLElement} toggleBtn - Botón de abrir/cerrar
 */
function alternarEvidencia(tarjeta, header, toggleBtn) {
  const estaAbierta = tarjeta.classList.contains('abierta');

  if (estaAbierta) {
    tarjeta.classList.remove('abierta');
    header.setAttribute('aria-expanded', 'false');
    if (toggleBtn) toggleBtn.textContent = 'ABRIR EVIDENCIA';
  } else {
    tarjeta.classList.add('abierta');
    header.setAttribute('aria-expanded', 'true');
    if (toggleBtn) toggleBtn.textContent = 'CERRAR EVIDENCIA';

    // Desplazar suavemente al inicio de la tarjeta
    setTimeout(() => {
      tarjeta.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}


// ── Construcción de pestañas ─────────────────────────────────────────────────

/**
 * Crea el contenedor de pestañas (tabs) para una evidencia.
 *
 * @param {number} cancionId - ID de la canción (para IDs únicos en el DOM)
 * @returns {Object} — Objeto con los elementos de tab y su contenedor
 */
function crearTabs(cancionId) {
  const contenedorTabs = document.createElement('div');
  contenedorTabs.className   = 'evidencia-tabs';
  contenedorTabs.setAttribute('role', 'tablist');

  const tabReproductor = crearTab('REPRODUCTOR', `tab-repro-${cancionId}`);
  const tabHistoria    = crearTab('HISTORIA',    `tab-hist-${cancionId}`);
  const tabLetra       = crearTab('LETRA',       `tab-letra-${cancionId}`);
  const tabCreditos    = crearTab('CRÉDITOS',    `tab-cred-${cancionId}`);

  contenedorTabs.append(tabReproductor, tabHistoria, tabLetra, tabCreditos);

  return { contenedorTabs, tabReproductor, tabHistoria, tabLetra, tabCreditos };
}


/**
 * Crea un botón de pestaña individual.
 *
 * @param {string} texto - Texto de la pestaña
 * @param {string} id    - ID único del botón
 * @returns {HTMLButtonElement}
 */
function crearTab(texto, id) {
  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.id        = id;
  btn.className = 'evidencia-tab';
  btn.setAttribute('role', 'tab');
  btn.textContent = texto;
  return btn;
}


/**
 * Activa una pestaña y oculta las demás.
 *
 * @param {HTMLElement} tabActiva  - Tab a activar
 * @param {HTMLElement} panelActivo - Panel a mostrar
 * @param {Array} todos - Array de {tab, panel} con todos los grupos
 */
function activarTab(tabActiva, panelActivo, todos) {
  todos.forEach(({ tab, panel }) => {
    tab.classList.remove('activo');
    panel.classList.remove('activo');
    tab.setAttribute('aria-selected', 'false');
  });

  tabActiva.classList.add('activo');
  panelActivo.classList.add('activo');
  tabActiva.setAttribute('aria-selected', 'true');
}


// ── Construcción de paneles de contenido ────────────────────────────────────

/**
 * Crea el panel del reproductor de audio.
 *
 * @param {Object} cancion - Objeto canción
 * @returns {HTMLElement}
 */
function crearPanelReproductor(cancion) {
  const panel = document.createElement('div');
  panel.className   = 'evidencia-panel';
  panel.setAttribute('role', 'tabpanel');

  panel.appendChild(crearReproductor(cancion));
  return panel;
}


/**
 * Crea un panel de texto genérico (Historia).
 *
 * @param {string} texto   - Contenido textual
 * @param {string} titulo  - Título de la sección
 * @returns {HTMLElement}
 */
function crearPanelTexto(texto, titulo) {
  const panel = document.createElement('div');
  panel.className = 'evidencia-panel';
  panel.setAttribute('role', 'tabpanel');

  const seccion = document.createElement('div');
  seccion.className = 'evidencia-seccion';

  const tituloEl = document.createElement('p');
  tituloEl.className   = 'evidencia-seccion__titulo';
  tituloEl.textContent = titulo || 'INFORMACIÓN';

  const textoEl = document.createElement('p');
  textoEl.className   = 'evidencia-seccion__texto';
  textoEl.textContent = texto || 'INFORMACIÓN NO DISPONIBLE EN ESTE EXPEDIENTE.';

  seccion.appendChild(tituloEl);
  seccion.appendChild(textoEl);
  panel.appendChild(seccion);

  return panel;
}


/**
 * Crea el panel de la letra de la canción.
 * Preserva saltos de línea y usa fuente de documento.
 *
 * @param {string} letra - Letra de la canción
 * @returns {HTMLElement}
 */
function crearPanelLetra(letra) {
  const panel = document.createElement('div');
  panel.className = 'evidencia-panel';
  panel.setAttribute('role', 'tabpanel');

  const seccion = document.createElement('div');
  seccion.className = 'evidencia-seccion';

  const tituloEl = document.createElement('p');
  tituloEl.className   = 'evidencia-seccion__titulo';
  tituloEl.textContent = 'TRANSCRIPCIÓN DE LETRA';

  const textoEl = document.createElement('pre');
  textoEl.className   = 'evidencia-seccion__texto';
  textoEl.style.cssText = `
    font-family:    var(--fuente-doc);
    white-space:    pre-wrap;
    word-wrap:      break-word;
    line-height:    1.9;
  `;
  textoEl.textContent = letra || 'LETRA NO DISPONIBLE EN ESTE EXPEDIENTE.';

  seccion.appendChild(tituloEl);
  seccion.appendChild(textoEl);
  panel.appendChild(seccion);

  return panel;
}


/**
 * Crea el panel de créditos de la canción.
 *
 * @param {string} creditos - Texto de créditos
 * @returns {HTMLElement}
 */
function crearPanelCreditos(creditos) {
  const panel = document.createElement('div');
  panel.className = 'evidencia-panel';
  panel.setAttribute('role', 'tabpanel');

  const seccion = document.createElement('div');
  seccion.className = 'evidencia-seccion';

  const tituloEl = document.createElement('p');
  tituloEl.className   = 'evidencia-seccion__titulo';
  tituloEl.textContent = 'FICHA TÉCNICA Y CRÉDITOS';

  const textoEl = document.createElement('pre');
  textoEl.className   = 'evidencia-seccion__creditos';
  textoEl.style.cssText = `
    white-space: pre-wrap;
    word-wrap:   break-word;
  `;
  textoEl.textContent = creditos || 'CRÉDITOS NO DISPONIBLES EN ESTE EXPEDIENTE.';

  seccion.appendChild(tituloEl);
  seccion.appendChild(textoEl);
  panel.appendChild(seccion);

  return panel;
}
