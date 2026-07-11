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
 *
 * FLUJO PRINCIPAL:
 *   1. boot()           → Animación de arranque del sistema
 *   2. screen-inicio    → Pantalla de inicio (VALIDAR CREDENCIAL)
 *   3. screen-auth      → Formulario de autenticación
 *   4. screen-credencial → Ficha del evaluador (IDENTIDAD CONFIRMADA)
 *   5. screen-expediente → Expediente completo con evidencias y evaluación
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

/**
 * Líneas del log de arranque del sistema.
 * Cada entrada tiene: texto, clase CSS de estilo y delay en ms.
 */
const LINEAS_BOOT = [
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 0   },
  { texto: 'MM&A PRODUCTION STUDIOS — SISTEMA DE DOCUMENTACIÓN', clase: 'info',      delay: 120 },
  { texto: 'VERSIÓN: 2.1.0 — EXPEDIENTE CSC-2026-MB',           clase: 'info',       delay: 240 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 360 },
  { texto: 'INICIALIZANDO MÓDULOS DEL SISTEMA...',               clase: 'info',       delay: 500 },
  { texto: '  [OK] MÓDULO DE AUTENTICACIÓN........... LISTO',   clase: 'ok',         delay: 700 },
  { texto: '  [OK] MÓDULO DE CREDENCIALES............ LISTO',   clase: 'ok',         delay: 900 },
  { texto: '  [OK] MÓDULO DE EXPEDIENTE.............. LISTO',   clase: 'ok',         delay: 1100 },
  { texto: '  [OK] MÓDULO DE EVALUACIÓN.............. LISTO',   clase: 'ok',         delay: 1300 },
  { texto: '  [OK] BASE DE DATOS LOCAL............... LISTO',   clase: 'ok',         delay: 1500 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 1700 },
  { texto: 'VERIFICANDO PROTOCOLOS DE SEGURIDAD...',             clase: 'info',       delay: 1900 },
  { texto: '  [OK] CIFRADO DE CREDENCIALES........... ACTIVO',  clase: 'ok',         delay: 2100 },
  { texto: '  [OK] REGISTRO DE SESIONES.............. ACTIVO',  clase: 'ok',         delay: 2250 },
  { texto: '  [OK] RESTRICCIÓN DE ACCESO............. NIVEL 3', clase: 'ok',         delay: 2400 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 2600 },
  { texto: 'EXPEDIENTE CSC-2026-MB: EL COLAPSO DEL SENTIDO COMÚN', clase: 'alerta', delay: 2800 },
  { texto: 'CLASIFICACIÓN: CAM-03 — RESTRINGIDO',                clase: 'alerta',    delay: 2950 },
  { texto: '──────────────────────────────────────────────────', clase: 'separador', delay: 3100 },
  { texto: 'SISTEMA OPERATIVO. LISTO PARA AUTENTICACIÓN.',       clase: 'ok',        delay: 3300 },
];

/** Tiempo total de la animación de arranque en ms */
const DURACION_BOOT = 3800;


// ── Función principal de arranque ────────────────────────────────────────────

/**
 * Punto de entrada de la aplicación.
 * Se ejecuta cuando el DOM está completamente cargado.
 */
async function iniciarAplicacion() {
  // 1. Inicializar todos los módulos
  inicializarModulos();

  // 2. Registrar los event listeners globales del sistema
  registrarEventosGlobales();

  // 3. Ejecutar la secuencia de arranque animada
  await ejecutarBoot();

  // 4. Mostrar la pantalla de inicio
  mostrarPantallaInicio();
}


// ── Inicialización de módulos ────────────────────────────────────────────────

/**
 * Inicializa todos los módulos de la aplicación.
 * El orden importa: auth antes que credencial, credencial antes que expediente.
 */
function inicializarModulos() {
  initAuth();
  initCredencial();
  initExpediente();
  initEvaluacion();
}


// ── Event listeners globales ─────────────────────────────────────────────────

/**
 * Registra los eventos de comunicación entre módulos.
 * Utiliza eventos personalizados del DOM como bus de mensajes.
 */
function registrarEventosGlobales() {

  // ── Evento: Autenticación exitosa ──────────────────────────────────────────
  // Disparado por auth.js cuando las credenciales son válidas.
  // Activa el renderizado de la pantalla de credencial.
  document.addEventListener('auth:exitoso', (e) => {
    const { usuario } = e.detail;
    renderizarCredencial(usuario);
  });


  // ── Evento: Consultar expediente desde la credencial ──────────────────────
  // Disparado por credencial.js cuando el usuario hace clic en "CONSULTAR EXPEDIENTE".
  document.addEventListener('credencial:consultarExpediente', () => {
    const usuario   = getUsuarioSesion();
    const idSesion  = getIdSesion();

    if (!usuario) {
      // Seguridad: si no hay sesión, volver al inicio
      mostrarPantalla(SCREENS.INICIO);
      return;
    }

    // Resetear el formulario de evaluación para esta sesión
    resetearEvaluacion();

    // Renderizar el expediente completo
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

/**
 * Ejecuta la secuencia de arranque animada del sistema.
 * Muestra líneas de log progresivamente para simular inicialización.
 *
 * @returns {Promise<void>} — Resuelve cuando termina la animación
 */
function ejecutarBoot() {
  return new Promise(resolve => {
    const contenedorLog = document.getElementById('boot-log');
    if (!contenedorLog) {
      resolve();
      return;
    }

    // Mostrar cada línea del log con su delay individual
    LINEAS_BOOT.forEach(({ texto, clase, delay }) => {
      setTimeout(() => {
        const linea = document.createElement('span');
        linea.className   = `boot-linea boot-linea--${clase}`;
        linea.textContent = texto;
        contenedorLog.appendChild(linea);

        // Desplazar al final del log automáticamente
        contenedorLog.scrollTop = contenedorLog.scrollHeight;
      }, delay);
    });

    // Resolver después de que todas las líneas sean mostradas
    setTimeout(() => resolve(), DURACION_BOOT);
  });
}


// ── Pantalla de inicio ───────────────────────────────────────────────────────

/**
 * Muestra la pantalla de inicio y actualiza la fecha del sistema.
 * Se llama después de completar el boot.
 */
function mostrarPantallaInicio() {
  // Actualizar fecha actual en la pantalla de inicio
  const fechaEl = document.getElementById('fecha-sistema');
  if (fechaEl) {
    fechaEl.textContent = formatearFechaInstitucional(new Date());
  }

  // Mostrar ID de sesión en el pie de la pantalla de inicio
  const sessionId = generarIdSesion();
  const sessionEl = document.getElementById('session-id-display');
  if (sessionEl) {
    sessionEl.textContent = `SESIÓN: ${sessionId}`;
  }

  // Transicionar a la pantalla de inicio
  mostrarPantalla(SCREENS.INICIO);
}


// ── Arranque de la aplicación ────────────────────────────────────────────────

/**
 * Esperar a que el DOM esté completamente cargado antes de iniciar.
 * Esto garantiza que todos los elementos existen en el DOM.
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicacion);
} else {
  // Si el DOM ya está listo (script cargado con defer o al final del body)
  iniciarAplicacion();
}
