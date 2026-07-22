/**
 * app.js — Módulo Principal de la Aplicación
 * ─────────────────────────────────────────────────────────────────────────────
 * PUNTO DE ENTRADA — EXPEDIENTE CSC-2026-MB
 *
 * Este módulo coordina todos los submódulos del sistema:
 *   - Inicializa cada módulo en el orden correcto
 *   - Registra los event listeners globales entre módulos
 *   - Gestiona la secuencia de arranque del sistema (boot animation)
 *   - Controla el flujo de navegación entre pantallas
 *   - Captura ubicación GEOLOCK y métricas de reproductor de audio
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Importación de módulos ───────────────────────────────────────────────────
import { initAuth, getUsuarioSesion, cerrarSesion } from './modules/auth.js';
import { initCredencial, renderizarCredencial, getIdSesion } from './modules/credencial.js';
import { initExpediente, renderizarExpediente } from './modules/expediente.js';
import { initEvaluacion, resetearEvaluacion } from './modules/evaluacion.js';
import {
  mostrarPantalla,
  SCREENS,
  formatearFechaLarga,
  formatearFechaInstitucional,
  setText,
  generarIdSesion
} from './modules/ui.js';


// ── Constantes del sistema ───────────────────────────────────────────────────

const LINEAS_BOOT = [
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 0   },
  { texto: 'MM&A PRODUCTION STUDIOS — SISTEMA DE DOCUMENTACIÓN', clase: 'info',      delay: 120 },
  { texto: 'VERSIÓN: 2.1.0 — EXPEDIENTE CSC-2026-MB',            clase: 'info',       delay: 240 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 360 },
  { texto: 'INICIALIZANDO MÓDULOS DEL SISTEMA...',               clase: 'info',       delay: 500 },
  { texto: '  [OK] MÓDULO DE AUTENTICACIÓN........... LISTO',   clase: 'ok',         delay: 700 },
  { texto: '  [OK] MÓDULO DE CREDENCIALES............ LISTO',   clase: 'ok',         delay: 900 },
  { texto: '  [OK] MÓDULO DE EXPEDIENTE.............. LISTO',   clase: 'ok',         delay: 1100 },
  { texto: '  [OK] MÓDULO DE EVALUACIÓN.............. LISTO',   clase: 'ok',         delay: 1300 },
  { texto: '  [OK] BASE DE DATOS LOCAL............... LISTO',   clase: 'ok',         delay: 1500 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 1700 },
  { texto: 'VERIFICANDO PROTOCOLOS DE SEGURIDAD...',              clase: 'info',       delay: 1900 },
  { texto: '  [OK] CIFRADO DE CREDENCIALES........... ACTIVO',  clase: 'ok',         delay: 2100 },
  { texto: '  [OK] REGISTRO DE SESIONES.............. ACTIVO',  clase: 'ok',         delay: 2250 },
  { texto: '  [OK] RESTRICCIÓN DE ACCESO............. NIVEL 3', clase: 'ok',         delay: 2400 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 2600 },
  { texto: 'EXPEDIENTE CSC-2026-MB: EL COLAPSO DEL SENTIDO COMÚN', clase: 'alerta', delay: 2800 },
  { texto: 'CLASIFICACIÓN: CAM-03 — RESTRINGIDO',                clase: 'alerta',    delay: 2950 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 3100 },
  { texto: 'SISTEMA OPERATIVO. LISTO PARA AUTENTICACIÓN.',       clase: 'ok',        delay: 3300 },
];

const DURACION_BOOT = 3800;


// ── Helper: Registrar GEOLOCK al iniciar sesión ─────────────────────────────

async function registrarGeolock(usuario) {
  try {
    const emailUsuario = usuario?.email || usuario?.numeroExpediente || usuario?.nombre;
    if (!emailUsuario) return;

    // Obtener país e IP
    const res = await fetch('https://ipapi.co/json/');
    const geo = await res.json();
    const paisStr = geo.country_name ? `${geo.country_name} (${geo.country_code})` : 'Desconocido';

    // Enviar a la API para guardar en columna BG de Google Sheets
    await fetch('/api/sheets/geolock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailUsuario,
        country: paisStr,
        ip: geo.ip || ''
      })
    });
  } catch (err) {
    console.warn('[GEOLOCK] No se pudo registrar la ubicación:', err);
  }
}


// ── Helper: Captura global de eventos de reproductor de audio ───────────────

function registrarMonitoreoAudio() {
  // Captura el evento nativo de 'play' en cualquier reproductor de la página
  document.addEventListener('play', (event) => {
    try {
      const usuario = getUsuarioSesion();
      const emailUsuario = usuario?.email || usuario?.numeroExpediente || usuario?.nombre || 'Anónimo';
      const audioElem = event.target;
      
      // Obtener el nombre o título de la canción
      const tituloCancion = audioElem.getAttribute('data-title') || 
                            audioElem.title || 
                            audioElem.src?.split('/').pop() || 
                            'Pista sin nombre';

      fetch('/api/sheets/track-play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailUsuario,
          trackTitle: tituloCancion,
          action: 'play'
        })
      }).catch(err => console.warn('[AUDIO TRACK] Error registrando play:', err));
    } catch (e) {
      console.warn('[AUDIO TRACK] Error en captura:', e);
    }
  }, true);
}


// ── Función principal de arranque ────────────────────────────────────────────

async function iniciarAplicacion() {
  inicializarModulos();
  registrarEventosGlobales();
  registrarMonitoreoAudio();
  await ejecutarBoot();
  mostrarPantallaInicio();
}


// ── Inicialización de módulos ────────────────────────────────────────────────

function inicializarModulos() {
  initAuth();
  initCredencial();
  initExpediente();
  initEvaluacion();
}


// ── Event listeners globales ─────────────────────────────────────────────────

function registrarEventosGlobales() {

  // ── Evento: Autenticación exitosa ──────────────────────────────────────────
  document.addEventListener('auth:exitoso', (e) => {
    const { usuario } = e.detail;
    renderizarCredencial(usuario);
    
    // Dispara el guardado automático de GEOLOCK en la columna BG
    registrarGeolock(usuario);
  });


  // ── Evento: Consultar expediente desde la credencial ──────────────────────
  document.addEventListener('credencial:consultarExpediente', () => {
    const usuario   = getUsuarioSesion();
    const idSesion  = getIdSesion();

    if (!usuario) {
      mostrarPantalla(SCREENS.INICIO);
      return;
    }

    resetearEvaluacion();
    renderizarExpediente(usuario, idSesion);
  });


  // ── Botón VALIDAR CREDENCIAL en la pantalla de inicio ─────────────────────
  const btnValidar = document.getElementById('btn-validar');
  if (btnValidar) {
    btnValidar.addEventListener('click', () => {
      mostrarPantalla(SCREENS.AUTH);
    });
  }
}


// ── Animación de arranque del sistema ────────────────────────────────────────

function ejecutarBoot() {
  return new Promise(resolve => {
    const contenedorLog = document.getElementById('boot-log');
    if (!contenedorLog) {
      resolve();
      return;
    }

    LINEAS_BOOT.forEach(({ texto, clase, delay }) => {
      setTimeout(() => {
        const linea = document.createElement('span');
        linea.className   = `boot-linea boot-linea--${clase}`;
        linea.textContent = texto;
        contenedorLog.appendChild(linea);
        contenedorLog.scrollTop = contenedorLog.scrollHeight;
      }, delay);
    });

    setTimeout(() => resolve(), DURACION_BOOT);
  });
}


// ── Pantalla de inicio ───────────────────────────────────────────────────────

function mostrarPantallaInicio() {
  const fechaEl = document.getElementById('fecha-sistema');
  if (fechaEl) {
    fechaEl.textContent = formatearFechaInstitucional(new Date());
  }

  const sessionId = generarIdSesion();
  const sessionEl = document.getElementById('session-id-display');
  if (sessionEl) {
    sessionEl.textContent = `SESIÓN: ${sessionId}`;
  }

  mostrarPantalla(SCREENS.INICIO);
}


// ── Arranque de la aplicación ────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicacion);
} else {
  iniciarAplicacion();
}
