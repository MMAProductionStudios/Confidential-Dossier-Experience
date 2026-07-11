/**
 * ui.js — Módulo de Utilidades de Interfaz
 * ─────────────────────────────────────────────────────────────────────────────
 * GESTIÓN DE PANTALLAS Y UTILIDADES VISUALES — EXPEDIENTE CSC-2026-MB
 *
 * Centraliza todas las operaciones de transición entre pantallas,
 * formateo de fechas, redacción de datos sensibles y utilidades DOM.
 * ─────────────────────────────────────────────────────────────────────────────
 */


// ── Almacenamiento seguro ────────────────────────────────────────────────────
// sessionStorage puede estar bloqueado dentro de iframes (política de terceros).
// Este wrapper intenta usarlo y cae silenciosamente a memoria si falla.
const _mem = {};
const _storageOk = (() => {
  try {
    sessionStorage.setItem('__probe', '1');
    sessionStorage.removeItem('__probe');
    return true;
  } catch (_) {
    return false;
  }
})();

export const safeStorage = {
  setItem:    (k, v) => { try { if (_storageOk) sessionStorage.setItem(k, v); } catch(_) {} _mem[k] = v; },
  getItem:    (k)    => { try { if (_storageOk) return sessionStorage.getItem(k); } catch(_) {} return _mem[k] ?? null; },
  removeItem: (k)    => { try { if (_storageOk) sessionStorage.removeItem(k); } catch(_) {} delete _mem[k]; },
};


// ── IDs de las pantallas del sistema ────────────────────────────────────────
const PANTALLAS = {
  BOOT:        'screen-boot',
  INICIO:      'screen-inicio',
  AUTH:        'screen-auth',
  CREDENCIAL:  'screen-credencial',
  EXPEDIENTE:  'screen-expediente'
};

// Pantalla actualmente visible
let pantallaActual = PANTALLAS.BOOT;


/**
 * Transiciona de una pantalla a otra.
 * Solo una pantalla puede estar visible (clase .active) a la vez.
 *
 * @param {string} idPantalla - ID del elemento <div> de la pantalla destino
 */
export function mostrarPantalla(idPantalla) {
  // Ocultar todas las pantallas
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Mostrar la pantalla solicitada
  const pantalla = document.getElementById(idPantalla);
  if (pantalla) {
    pantalla.classList.add('active');
    pantallaActual = idPantalla;

    // Desplazar al inicio de la pantalla
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else {
    console.error(`[UI] Pantalla no encontrada: ${idPantalla}`);
  }
}

// Exportar IDs de pantallas para uso en otros módulos
export const SCREENS = PANTALLAS;


/**
 * Formatea una fecha para mostrarla en estilo institucional.
 * Ejemplo: "11 JUL 2026 — 14:32:05 HRS"
 *
 * @param {Date|string} fecha - Fecha a formatear (Date o ISO string)
 * @returns {string} — Fecha formateada
 */
export function formatearFechaInstitucional(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);

  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
                 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const dia  = String(d.getDate()).padStart(2, '0');
  const mes  = meses[d.getMonth()];
  const año  = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  const seg  = String(d.getSeconds()).padStart(2, '0');

  return `${dia} ${mes} ${año} — ${hora}:${min}:${seg} HRS`;
}


/**
 * Formatea la fecha actual para el encabezado del sistema.
 * Ejemplo: "SÁBADO 11 DE JULIO DE 2026"
 *
 * @returns {string} — Fecha larga en español
 */
export function formatearFechaLarga() {
  const d = new Date();
  const diasSemana = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
  const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                 'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

  return `${diasSemana[d.getDay()]} ${d.getDate()} DE ${meses[d.getMonth()]} DE ${d.getFullYear()}`;
}


/**
 * Redacta parcialmente un correo electrónico para mostrar información
 * parcialmente clasificada (efecto de expediente gubernamental).
 *
 * Ejemplo: "joseluis@email.com" → "jos██████@e█████.com"
 *
 * @param {string} email - Correo electrónico completo
 * @returns {string} — Correo parcialmente redactado
 */
export function redactarEmail(email) {
  if (!email || typeof email !== 'string') return '████████████';

  const partes     = email.split('@');
  const usuario    = partes[0];
  const dominio    = partes[1] || '';
  const parteDominio = dominio.split('.');
  const extension  = parteDominio.pop();
  const nombreDom  = parteDominio.join('.');

  // Mostrar primeras 3 letras del usuario, redactar el resto
  const usuarioRedactado = usuario.length > 3
    ? usuario.slice(0, 3) + '██████'
    : usuario.slice(0, 1) + '████';

  // Mostrar primera letra del dominio, redactar el resto
  const dominioRedactado = nombreDom.length > 1
    ? nombreDom.slice(0, 1) + '█████'
    : '█████';

  return `${usuarioRedactado}@${dominioRedactado}.${extension}`;
}


/**
 * Redacta parcialmente un número de teléfono.
 *
 * Ejemplo: "+52-492-555-5555" → "+52-492-555-████"
 *
 * @param {string} telefono - Número de teléfono completo
 * @returns {string} — Teléfono parcialmente redactado
 */
export function redactarTelefono(telefono) {
  if (!telefono || typeof telefono !== 'string') return '████████████';

  // Mantener los primeros dígitos, redactar los últimos 4
  const longitud = telefono.length;

  if (longitud <= 4) return '████';

  // Mostrar todo excepto los últimos 4 caracteres
  return telefono.slice(0, longitud - 4) + '████';
}


/**
 * Genera un ID de sesión aleatorio para uso en el sistema.
 * Formato: "SES-XXXXXXXX" donde X son caracteres alfanuméricos.
 *
 * @returns {string} — ID de sesión único
 */
export function generarIdSesion() {
  const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let resultado = 'SES-';
  for (let i = 0; i < 8; i++) {
    resultado += chars[Math.floor(Math.random() * chars.length)];
  }
  return resultado;
}


/**
 * Establece el texto de un elemento por su ID de forma segura.
 * Si el elemento no existe, no lanza error.
 *
 * @param {string} id      - ID del elemento DOM
 * @param {string} texto   - Texto a establecer
 */
export function setText(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}


/**
 * Establece el HTML interno de un elemento por su ID.
 * Solo usar con contenido de confianza (no de usuario).
 *
 * @param {string} id   - ID del elemento DOM
 * @param {string} html - HTML a insertar
 */
export function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}


/**
 * Muestra u oculta un elemento por su ID.
 *
 * @param {string} id      - ID del elemento DOM
 * @param {boolean} visible - true = mostrar, false = ocultar
 */
export function setVisible(id, visible) {
  const el = document.getElementById(id);
  if (el) {
    if (visible) {
      el.removeAttribute('hidden');
    } else {
      el.setAttribute('hidden', '');
    }
  }
}


/**
 * Muestra un mensaje de error en un elemento del DOM.
 * Limpia el contenido previo y hace visible el elemento.
 *
 * @param {string} idElemento - ID del elemento de error
 * @param {string} mensaje     - Texto del error a mostrar
 */
export function mostrarError(idElemento, mensaje) {
  const el = document.getElementById(idElemento);
  if (el) {
    el.textContent = mensaje;
    el.removeAttribute('hidden');
  }
}


/**
 * Limpia y oculta un elemento de mensaje (error o éxito).
 *
 * @param {string} idElemento - ID del elemento a limpiar
 */
export function limpiarMensaje(idElemento) {
  const el = document.getElementById(idElemento);
  if (el) {
    el.textContent = '';
    el.setAttribute('hidden', '');
  }
}


/**
 * Activa o desactiva el estado de carga de un botón.
 * Deshabilita el botón y cambia su texto durante operaciones asíncronas.
 *
 * @param {string}  idBoton   - ID del botón
 * @param {boolean} cargando  - true = estado de carga, false = estado normal
 * @param {string}  textoCarga - Texto a mostrar durante la carga
 */
export function setBotonCargando(idBoton, cargando, textoCarga = 'PROCESANDO...') {
  const btn = document.getElementById(idBoton);
  if (!btn) return;

  if (cargando) {
    btn.setAttribute('data-texto-original', btn.textContent.trim());
    btn.textContent = textoCarga;
    btn.disabled    = true;
    btn.setAttribute('aria-busy', 'true');
  } else {
    const textoOriginal = btn.getAttribute('data-texto-original');
    if (textoOriginal) btn.textContent = textoOriginal;
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}
