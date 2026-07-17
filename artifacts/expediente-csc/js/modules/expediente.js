/**
 * expediente.js — Módulo del Expediente
 * ─────────────────────────────────────────────────────────────────────────────
 * PANTALLA PRINCIPAL DEL EXPEDIENTE — EXPEDIENTE CSC-2026-MB
 *
 * Gestiona la pantalla principal del expediente:
 *   - Renderiza las evidencias (canciones) como tarjetas expandibles
 *   - Muestra el reproductor de audio por cada evidencia
 *   - Muestra Historia, Letra y Créditos como secciones colapsables debajo
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
 * @param {Object} usuario  - Objeto del usuario autenticado
 * @param {string} idSesion - ID de sesión generado por el módulo de credencial
 */
export async function renderizarExpediente(usuario, idSesion) {

  setText('exp-nombre-evaluador', usuario.nombre || '—');
  setText('exp-fecha-acceso',     formatearFechaInstitucional(new Date()));
  setText('exp-footer-evaluador', `EVALUADOR: ${usuario.nombre || '—'}`);
  setText('exp-footer-fecha',     formatearFechaLarga());

  mostrarPantalla(SCREENS.EXPEDIENTE);

  try {
    const canciones = await obtenerCanciones();
    renderizarEvidencias(canciones);
  } catch (error) {
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
 *
 * @param {Array} canciones - Array de objetos canción de canciones.json
 */
function renderizarEvidencias(canciones) {
  const lista    = document.getElementById('evidencias-lista');
  const cargando = document.getElementById('evidencias-cargando');

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

  canciones.forEach((cancion, indice) => {
    const tarjeta = crearTarjetaEvidencia(cancion, indice + 1);
    lista.appendChild(tarjeta);
  });
}


/**
 * Crea el elemento DOM de una tarjeta de evidencia expandible.
 *
 * Estructura:
 *   article.evidencia
 *     .evidencia__header        (clic para abrir/cerrar)
 *     .evidencia__contenido     (oculto por defecto)
 *       .reproductor            (reproductor de audio / embed)
 *       .ev-acordeon*N          (Historia / Letra / Créditos — colapsables)
 *
 * @param {Object} cancion - Objeto canción de canciones.json
 * @param {number} numero  - Número de evidencia (1, 2, 3...)
 * @returns {HTMLElement}
 */
function crearTarjetaEvidencia(cancion, numero) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'evidencia';
  tarjeta.id        = `evidencia-${cancion.id}`;

  const numFormato = String(numero).padStart(2, '0');

  // ── Encabezado ─────────────────────────────────────────────────────────────
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

  // ── Contenido expandible ───────────────────────────────────────────────────
  const contenido = document.createElement('div');
  contenido.className = 'evidencia__contenido';
  contenido.setAttribute('role', 'region');
  contenido.setAttribute('aria-label', `Contenido de la evidencia ${numFormato}`);

  if (cancion.subtitulo) {
    const sub = document.createElement('p');
    sub.className   = 'evidencia__subtitulo';
    sub.textContent = cancion.subtitulo;
    contenido.appendChild(sub);
  }

  // Reproductor con líricas, notas, reacción, rating y tabs integrados
  contenido.appendChild(crearReproductor(cancion));

  // ── Toggle abrir/cerrar ────────────────────────────────────────────────────
  const toggleBtn = header.querySelector('.evidencia__toggle');

  const abrirCerrar = () => alternarEvidencia(tarjeta, header, toggleBtn);

  // Clic en el botón abre/cierra (sin burbujeo doble)
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirCerrar();
  });

  // Clic en el resto del header también abre/cierra
  header.addEventListener('click', (e) => {
    if (e.target === toggleBtn) return;
    abrirCerrar();
  });

  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirCerrar();
    }
  });

  tarjeta.appendChild(header);
  tarjeta.appendChild(contenido);

  return tarjeta;
}


/**
 * Alterna apertura/cierre de una evidencia.
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

    setTimeout(() => {
      tarjeta.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}


