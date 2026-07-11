/**
 * auth.js — Módulo de Autenticación
 * ─────────────────────────────────────────────────────────────────────────────
 * VERIFICACIÓN DE CREDENCIALES — EXPEDIENTE CSC-2026-MB
 *
 * Gestiona el formulario de autenticación, la validación de campos,
 * la consulta a la base de datos y la transición a la pantalla de credencial.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buscarUsuario, registrarAcceso } from './db.js';
import {
  mostrarPantalla,
  SCREENS,
  mostrarError,
  limpiarMensaje,
  setVisible,
  setBotonCargando
} from './ui.js';


// ── Estado del módulo ────────────────────────────────────────────────────────

/**
 * Almacena el usuario autenticado en la sesión actual.
 * Este objeto se comparte con otros módulos a través del getter exportado.
 * @type {Object|null}
 */
let usuarioSesion = null;

/**
 * Contador de intentos fallidos de autenticación.
 * En una implementación con backend real, este contador se persistiría.
 * @type {number}
 */
let intentosFallidos = 0;

/** Número máximo de intentos antes de bloqueo temporal */
const MAX_INTENTOS = 5;


// ── Inicialización del módulo ────────────────────────────────────────────────

/**
 * Inicializa el módulo de autenticación.
 * Registra los event listeners del formulario.
 * Se llama una sola vez desde app.js al cargar la aplicación.
 */
export function initAuth() {
  const form       = document.getElementById('form-auth');
  const btnRegresar = document.getElementById('btn-regresar');

  if (!form) {
    console.error('[Auth] Formulario #form-auth no encontrado.');
    return;
  }

  // Envío del formulario de autenticación
  form.addEventListener('submit', manejarAutenticacion);

  // Botón regresar: vuelve a la pantalla de inicio
  if (btnRegresar) {
    btnRegresar.addEventListener('click', () => {
      limpiarFormulario();
      mostrarPantalla(SCREENS.INICIO);
    });
  }

  // Limpiar errores de campo al escribir
  const inputExpediente = document.getElementById('campo-expediente');
  const inputCodigo     = document.getElementById('campo-codigo');

  if (inputExpediente) {
    inputExpediente.addEventListener('input', () => {
      limpiarErrorCampo('campo-expediente', 'expediente-error');
    });
  }

  if (inputCodigo) {
    inputCodigo.addEventListener('input', () => {
      limpiarErrorCampo('campo-codigo', 'codigo-error');
    });
  }
}


// ── Manejador del envío del formulario ──────────────────────────────────────

/**
 * Maneja el envío del formulario de autenticación.
 * Valida campos, consulta la base de datos y transiciona según resultado.
 *
 * @param {Event} e - Evento de submit del formulario
 */
async function manejarAutenticacion(e) {
  e.preventDefault();

  // Verificar bloqueo por exceso de intentos
  if (intentosFallidos >= MAX_INTENTOS) {
    mostrarError('auth-error-global',
      'ACCESO BLOQUEADO. NÚMERO MÁXIMO DE INTENTOS ALCANZADO. ' +
      'CONTACTE A COORDINACIÓN PARA RESTABLECER SU ACCESO.'
    );
    return;
  }

  // Limpiar mensajes previos
  limpiarMensaje('auth-error-global');
  limpiarErrorCampo('campo-expediente', 'expediente-error');
  limpiarErrorCampo('campo-codigo', 'codigo-error');

  // Obtener valores
  const expediente = document.getElementById('campo-expediente')?.value.trim() || '';
  const codigo     = document.getElementById('campo-codigo')?.value.trim() || '';

  // Validar campos
  const esValido = validarCampos(expediente, codigo);
  if (!esValido) return;

  // Mostrar indicador de proceso
  setVisible('auth-procesando', true);
  setBotonCargando('btn-autenticar', true, 'VERIFICANDO...');

  try {
    // Consultar base de datos
    const usuario = await buscarUsuario(expediente, codigo);

    if (usuario) {
      // Autenticación exitosa
      intentosFallidos = 0;
      usuarioSesion    = usuario;

      // Registrar acceso
      await registrarAcceso(usuario.id);

      // Guardar en sessionStorage para persistencia durante la sesión
      sessionStorage.setItem('usuario_sesion', JSON.stringify(usuario));

      // Transicionar a pantalla de credencial
      // El evento personalizado notifica al módulo de credencial
      document.dispatchEvent(new CustomEvent('auth:exitoso', {
        detail: { usuario }
      }));

    } else {
      // Credenciales inválidas
      intentosFallidos++;

      const restantes = MAX_INTENTOS - intentosFallidos;

      mostrarError('auth-error-global',
        `CREDENCIALES NO VÁLIDAS. REGISTRO NO ENCONTRADO O ACCESO INACTIVO. ` +
        `INTENTOS RESTANTES: ${restantes}`
      );
    }

  } catch (error) {
    console.error('[Auth] Error al verificar credenciales:', error);
    mostrarError('auth-error-global',
      'ERROR DEL SISTEMA. NO SE PUDO COMPLETAR LA VERIFICACIÓN. ' +
      'INTENTE NUEVAMENTE O CONTACTE A SOPORTE TÉCNICO.'
    );

  } finally {
    // Siempre ocultar el indicador de proceso y restaurar el botón
    setVisible('auth-procesando', false);
    setBotonCargando('btn-autenticar', false);
  }
}


// ── Validación de campos ─────────────────────────────────────────────────────

/**
 * Valida el contenido de los campos del formulario de autenticación.
 *
 * @param {string} expediente - Número de expediente ingresado
 * @param {string} codigo     - Código de autorización ingresado
 * @returns {boolean} — true si todos los campos son válidos
 */
function validarCampos(expediente, codigo) {
  let esValido = true;

  // Validar número de expediente
  if (!expediente) {
    marcarErrorCampo('campo-expediente', 'expediente-error',
      'CAMPO REQUERIDO. INGRESE EL NÚMERO DE EXPEDIENTE ASIGNADO.');
    esValido = false;

  } else if (expediente.length < 5) {
    marcarErrorCampo('campo-expediente', 'expediente-error',
      'NÚMERO DE EXPEDIENTE INSUFICIENTE. VERIFIQUE EL FORMATO.');
    esValido = false;
  }

  // Validar código de autorización
  if (!codigo) {
    marcarErrorCampo('campo-codigo', 'codigo-error',
      'CAMPO REQUERIDO. INGRESE EL CÓDIGO DE AUTORIZACIÓN ASIGNADO.');
    esValido = false;

  } else if (codigo.length < 4) {
    marcarErrorCampo('campo-codigo', 'codigo-error',
      'CÓDIGO DE AUTORIZACIÓN INSUFICIENTE. MÍNIMO 4 CARACTERES.');
    esValido = false;
  }

  return esValido;
}


// ── Utilidades de error por campo ────────────────────────────────────────────

/**
 * Marca un campo del formulario como erróneo y muestra el mensaje de error.
 *
 * @param {string} idCampo   - ID del elemento input/wrapper del campo
 * @param {string} idError   - ID del elemento de mensaje de error
 * @param {string} mensaje   - Texto del error
 */
function marcarErrorCampo(idCampo, idError, mensaje) {
  const wrapper = document.getElementById(idCampo)?.closest('.form-campo');
  if (wrapper) wrapper.classList.add('form-campo--error');

  const errorEl = document.getElementById(idError);
  if (errorEl) errorEl.textContent = mensaje;
}


/**
 * Limpia el estado de error de un campo del formulario.
 *
 * @param {string} idCampo - ID del input del campo
 * @param {string} idError - ID del elemento de error del campo
 */
function limpiarErrorCampo(idCampo, idError) {
  const wrapper = document.getElementById(idCampo)?.closest('.form-campo');
  if (wrapper) wrapper.classList.remove('form-campo--error');

  const errorEl = document.getElementById(idError);
  if (errorEl) errorEl.textContent = '';
}


// ── Limpieza del formulario ──────────────────────────────────────────────────

/**
 * Limpia todos los campos y mensajes del formulario de autenticación.
 */
function limpiarFormulario() {
  const form = document.getElementById('form-auth');
  if (form) form.reset();

  limpiarMensaje('auth-error-global');
  limpiarErrorCampo('campo-expediente', 'expediente-error');
  limpiarErrorCampo('campo-codigo', 'codigo-error');
  setVisible('auth-procesando', false);
}


// ── Getters exportados ───────────────────────────────────────────────────────

/**
 * Retorna el objeto del usuario actualmente autenticado.
 * Devuelve null si no hay sesión activa.
 *
 * @returns {Object|null}
 */
export function getUsuarioSesion() {
  if (usuarioSesion) return usuarioSesion;

  // Intentar recuperar de sessionStorage
  const guardado = sessionStorage.getItem('usuario_sesion');
  if (guardado) {
    usuarioSesion = JSON.parse(guardado);
    return usuarioSesion;
  }

  return null;
}


/**
 * Cierra la sesión del usuario actual.
 * Limpia el sessionStorage y resetea el estado del módulo.
 */
export function cerrarSesion() {
  usuarioSesion    = null;
  intentosFallidos = 0;

  sessionStorage.removeItem('usuario_sesion');
  sessionStorage.removeItem('ultimo_acceso');
  sessionStorage.removeItem('evaluacion_registrada');

  limpiarFormulario();
}
