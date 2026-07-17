/**
 * evaluacion.js — Módulo de Evaluación
 * ─────────────────────────────────────────────────────────────────────────────
 * REGISTRO DE EVALUACIÓN — EXPEDIENTE CSC-2026-MB
 *
 * Gestiona el formulario de evaluación del expediente:
 *   - Selector numérico de calificación (1–10)
 *   - Validación de campos requeridos
 *   - Envío a la base de datos (simulado en JSON, listo para Supabase/Firebase)
 *   - Estado del formulario (PENDIENTE / COMPLETADO)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { registrarEvaluacion } from './db.js';
import { getUsuarioSesion } from './auth.js';
import {
  mostrarPantalla,
  SCREENS,
  mostrarError,
  limpiarMensaje,
  setVisible,
  setBotonCargando,
  setText
} from './ui.js';


// ── Estado del módulo ────────────────────────────────────────────────────────

/**
 * Indica si el formulario de evaluación ya fue enviado.
 * Evita envíos duplicados.
 * @type {boolean}
 */
let evaluacionEnviada = false;


/**
 * Inicializa el módulo de evaluación.
 * Crea el selector de calificación y registra el listener del formulario.
 * Se llama una sola vez desde app.js.
 */
export function initEvaluacion() {
  const form = document.getElementById('form-evaluacion');
  if (form) {
    form.addEventListener('submit', manejarEnvioEvaluacion);
  }
}


// ── Envío del formulario de evaluación ──────────────────────────────────────

/**
 * Maneja el envío del formulario de evaluación.
 * Valida, serializa y envía los datos a la capa de base de datos.
 *
 * @param {Event} e - Evento de submit del formulario
 */
async function manejarEnvioEvaluacion(e) {
  e.preventDefault();

  // Prevenir envíos duplicados
  if (evaluacionEnviada) {
    mostrarError('eval-error', 'LA EVALUACIÓN YA FUE REGISTRADA PREVIAMENTE.');
    return;
  }

  // Limpiar mensajes previos
  limpiarMensaje('eval-error');
  limpiarMensaje('eval-exito');

  // Recoger datos del formulario
  const pregunta1 = document.getElementById('eval-p1')?.value.trim() || '';
  const pregunta2 = document.getElementById('eval-p2')?.value.trim() || '';
  const pregunta3 = document.getElementById('eval-p3')?.value.trim() || '';
  const pregunta4 = document.getElementById('eval-p4')?.value.trim() || '';
  const pregunta5 = document.getElementById('eval-p5')?.value.trim() || '';

  // Validar campos requeridos (pregunta 1 y pregunta 5)
  const esValido = validarFormularioEvaluacion(pregunta1, pregunta5);
  if (!esValido) return;

  // Obtener usuario de la sesión actual
  const usuario = getUsuarioSesion();

  // Construir objeto de evaluación
  const evaluacion = {
    usuarioId:  usuario?.id || null,
    expediente: 'CSC-2026-MB',
    pregunta1,
    pregunta2,
    pregunta3,
    pregunta4,
    pregunta5
  };

  // Deshabilitar botón durante el proceso
  setBotonCargando('btn-registrar-evaluacion', true, 'REGISTRANDO EVALUACIÓN...');

  try {
    // Enviar a la base de datos (simulada)
    const resultado = await registrarEvaluacion(evaluacion);

    if (resultado.exito) {
      evaluacionEnviada = true;

      // Actualizar estado del formulario
      actualizarEstadoFormulario('COMPLETADO');

      // Deshabilitar el formulario para evitar modificaciones
      deshabilitarFormulario();

      // Navegar a la pantalla de agradecimiento tras un breve destello de confirmación
      setTimeout(() => {
        mostrarPantalla(SCREENS.GRACIAS);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 800);

    } else {
      mostrarError('eval-error',
        'ERROR AL REGISTRAR LA EVALUACIÓN. INTENTE NUEVAMENTE.'
      );
    }

  } catch (error) {
    console.error('[Evaluacion] Error al registrar:', error);
    mostrarError('eval-error',
      'ERROR DEL SISTEMA. NO SE PUDO REGISTRAR LA EVALUACIÓN. ' +
      'CONTACTE A SOPORTE TÉCNICO.'
    );

  } finally {
    // Solo restaurar el botón si no fue enviado exitosamente
    if (!evaluacionEnviada) {
      setBotonCargando('btn-registrar-evaluacion', false);
    }
  }
}


// ── Validación del formulario ────────────────────────────────────────────────

/**
 * Valida los campos requeridos del formulario de evaluación.
 *
 * @param {number} calificacion    - Puntuación seleccionada (0 si ninguna)
 * @param {string} observaciones   - Texto de observaciones
 * @param {string} comentarioFinal - Texto del comentario final
 * @returns {boolean} — true si todos los campos requeridos son válidos
 */
function validarFormularioEvaluacion(pregunta1, pregunta5) {
  const errores = [];

  if (!pregunta1 || pregunta1.length < 5) {
    errores.push('PREGUNTA 01 REQUERIDA: INDIQUE CUÁL CANCIÓN CONSIDERA MÁS REPRESENTATIVA.');
  }

  if (!pregunta5 || pregunta5.length < 5) {
    errores.push('PREGUNTA 05 REQUERIDA: REGISTRE SU CONCLUSIÓN FINAL.');
  }

  if (errores.length > 0) {
    mostrarError('eval-error', errores.join('\n'));
    return false;
  }

  return true;
}


// ── Utilidades post-envío ────────────────────────────────────────────────────

/**
 * Actualiza el indicador de estado del formulario de evaluación.
 *
 * @param {string} estado - Texto del estado (ej: "COMPLETADO", "PENDIENTE")
 */
function actualizarEstadoFormulario(estado) {
  const estadoEl = document.getElementById('eval-estado');
  if (estadoEl) {
    estadoEl.textContent = estado;
    if (estado === 'COMPLETADO') {
      estadoEl.classList.add('completado');
    }
  }
}


/**
 * Deshabilita todos los controles del formulario de evaluación.
 * Se llama después de un envío exitoso para evitar modificaciones.
 */
function deshabilitarFormulario() {
  const form = document.getElementById('form-evaluacion');
  if (!form) return;

  // Deshabilitar todos los inputs y textareas
  form.querySelectorAll('input, textarea, button').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.5';
    el.style.cursor  = 'not-allowed';
  });

  // Ocultar botón de envío y mostrar estado
  const btnEnviar = document.getElementById('btn-registrar-evaluacion');
  if (btnEnviar) {
    btnEnviar.textContent = '✓ EVALUACIÓN REGISTRADA';
    btnEnviar.style.backgroundColor = 'var(--color-operativo-bg)';
    btnEnviar.style.borderColor     = 'var(--color-operativo)';
    btnEnviar.style.color           = 'var(--color-operativo-texto)';
  }
}


/**
 * Resetea el estado del módulo de evaluación.
 * Se llama al cerrar sesión o iniciar una nueva sesión.
 */
export function resetearEvaluacion() {
  evaluacionEnviada = false;

  // Resetear formulario
  const form = document.getElementById('form-evaluacion');
  if (form) {
    form.reset();
    form.querySelectorAll('input, textarea, button').forEach(el => {
      el.disabled       = false;
      el.style.opacity  = '';
      el.style.cursor   = '';
    });
  }

  // Limpiar mensajes
  limpiarMensaje('eval-error');
  limpiarMensaje('eval-exito');
  actualizarEstadoFormulario('PENDIENTE');
}
