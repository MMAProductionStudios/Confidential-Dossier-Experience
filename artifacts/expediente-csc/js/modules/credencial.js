/**
 * credencial.js — Módulo de Credencial del Evaluador
 * ─────────────────────────────────────────────────────────────────────────────
 * PANTALLA DE IDENTIDAD CONFIRMADA — EXPEDIENTE CSC-2026-MB
 *
 * Renderiza la ficha del evaluador con sus datos personales una vez que
 * la autenticación ha sido exitosa. Gestiona la redacción de datos
 * sensibles y la transición al expediente completo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  mostrarPantalla,
  SCREENS,
  formatearFechaInstitucional,
  redactarEmail,
  redactarTelefono,
  setText,
  setHTML,
  setVisible,
  generarIdSesion
} from './ui.js';


// ── ID de sesión para esta visita ────────────────────────────────────────────
let idSesionActual = null;


/**
 * Inicializa el módulo de credencial.
 * Registra listeners para el botón de consultar expediente.
 */
export function initCredencial() {
  const btnConsultar = document.getElementById('btn-consultar');

  if (btnConsultar) {
    btnConsultar.addEventListener('click', () => {
      // Notificar al módulo del expediente que puede iniciar
      document.dispatchEvent(new CustomEvent('credencial:consultarExpediente'));
    });
  }
}


/**
 * Renderiza la pantalla de credencial con los datos del usuario autenticado.
 * Aplica redacción a datos sensibles (email, teléfono).
 *
 * @param {Object} usuario - Registro completo del usuario de la base de datos
 */
export function renderizarCredencial(usuario) {
  if (!usuario) {
    console.error('[Credencial] No se recibió objeto de usuario.');
    return;
  }

  // Generar ID de sesión para esta visita
  idSesionActual = generarIdSesion();

  // ── Sello de tiempo de autenticación ──────────────────────────────────────
  const ahora = new Date();
  const timestampFormateado = formatearFechaInstitucional(ahora);

  setText('confirmacion-timestamp',
    `AUTENTICADO: ${timestampFormateado}\nSESIÓN: ${idSesionActual}`
  );

  // ── Nivel de autorización (encabezado de la tarjeta) ──────────────────────
  setText('cred-nivel', usuario.nivelAutorizacion || 'CAM-03');

  // ── Fotografía del evaluador ───────────────────────────────────────────────
  const imgFoto = document.getElementById('cred-foto');
  if (imgFoto) {
    if (usuario.fotografia) {
      imgFoto.src  = usuario.fotografia;
      imgFoto.alt  = `Fotografía oficial de ${usuario.nombre}`;
      imgFoto.style.display = 'block';
    } else {
      // Mostrar fallback si no hay fotografía
      imgFoto.style.display = 'none';
      const fallback = document.getElementById('cred-foto-fallback');
      if (fallback) fallback.style.display = 'flex';
    }
  }

  // ── Datos de identidad ────────────────────────────────────────────────────
  setText('cred-nombre',       usuario.nombre            || '—');
  setText('cred-titulo',       usuario.tituloProfesional || '—');
  setText('cred-especialidad', usuario.especialidad      || '—');
  setText('cred-categoria',    usuario.categoria         || '—');

  // ── Datos geográficos ─────────────────────────────────────────────────────
  setText('cred-ciudad',      usuario.ciudad || '—');
  setText('cred-estado-geo',  usuario.estado || '—');
  setText('cred-pais',        usuario.pais   || '—');

  // ── Datos de contacto (parcialmente redactados) ───────────────────────────
  // El email y teléfono se muestran parcialmente clasificados
  setText('cred-email',    redactarEmail(usuario.email));
  setText('cred-telefono', redactarTelefono(usuario.telefono));

  // ── Nivel de autorización y estado ───────────────────────────────────────
  setText('cred-nivel-texto', usuario.nivelAutorizacion || 'CAM-03');

  const estadoEl = document.getElementById('cred-estado-registro');
  if (estadoEl) {
    estadoEl.textContent = usuario.activo ? 'ACTIVO' : 'INACTIVO';
    estadoEl.className   = 'dato-valor dato-valor--activo';
    if (!usuario.activo) {
      estadoEl.style.color = 'var(--color-alerta-texto)';
    }
  }

  // ── Mensaje personalizado (solo si tiene contenido) ───────────────────────
  if (usuario.mensajePersonalizado && usuario.mensajePersonalizado.trim()) {
    setText('cred-mensaje', usuario.mensajePersonalizado);
    setVisible('cred-mensaje-wrapper', true);
  } else {
    setVisible('cred-mensaje-wrapper', false);
  }

  // ── Metadatos del pie de tarjeta ──────────────────────────────────────────
  const ultimoAccesoEl = document.getElementById('cred-ultimo-acceso');
  if (ultimoAccesoEl) {
    if (usuario.ultimoAcceso) {
      ultimoAccesoEl.textContent = formatearFechaInstitucional(usuario.ultimoAcceso);
    } else {
      ultimoAccesoEl.textContent = 'PRIMER ACCESO';
    }
  }

  const evalEl = document.getElementById('cred-evaluacion-realizada');
  if (evalEl) {
    evalEl.textContent = usuario.evaluacionRealizada ? 'REGISTRADA' : 'PENDIENTE';
    evalEl.style.color = usuario.evaluacionRealizada
      ? 'var(--color-operativo-texto)'
      : 'var(--color-texto-apagado)';
  }

  // ── Sello de sesión en el pie ─────────────────────────────────────────────
  setText('cred-session-stamp', `SESIÓN: ${idSesionActual}`);

  // ── Mostrar la pantalla de credencial ─────────────────────────────────────
  mostrarPantalla(SCREENS.CREDENCIAL);
}


/**
 * Retorna el ID de sesión generado para la visita actual.
 * Lo usan otros módulos para estamparlo en el expediente.
 *
 * @returns {string|null}
 */
export function getIdSesion() {
  return idSesionActual;
}
