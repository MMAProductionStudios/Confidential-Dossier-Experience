/**
 * db.js — Módulo de Base de Datos
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA DE ABSTRACCIÓN DE DATOS — EXPEDIENTE CSC-2026-MB
 *
 * FUENTE ACTIVA: Google Sheets (vía api-server proxy)
 * FALLBACK:      archivos JSON locales (data/usuarios.json, data/canciones.json)
 *
 * El frontend llama al api-server en /api/sheets/*, que a su vez consulta
 * Google Sheets usando credenciales de cuenta de servicio (nunca expuestas
 * al navegador). Si el api-server no está configurado o falla, se usa el
 * JSON local como respaldo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { safeStorage } from './ui.js';

// ── Endpoints del api-server proxy ───────────────────────────────────────────
const API_BASE       = '/api/sheets';
const API_USUARIOS   = `${API_BASE}/usuarios`;
const API_CANCIONES  = `${API_BASE}/canciones`;
const API_STATUS     = `${API_BASE}/status`;

// ── Rutas locales de fallback ─────────────────────────────────────────────────
const RUTA_USUARIOS  = './data/usuarios.json';
const RUTA_CANCIONES = './data/canciones.json';

// ── Cache en memoria de la sesión ─────────────────────────────────────────────
let _usuariosCache  = null;
let _cancionesCache = null;


// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Obtiene datos del api-server. Si falla, intenta fallback a JSON local.
 *
 * @param {string} apiUrl    - URL del endpoint del api-server
 * @param {string} localRuta - Ruta del archivo JSON local de respaldo
 * @returns {Promise<Array>}
 */
async function fetchConFallback(apiUrl, localRuta) {
  // Intentar primero el api-server (Google Sheets)
  try {
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const json = await resp.json();
      if (json.ok && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (_) {
    // Silenciar — se cae al fallback
  }

  // Fallback: JSON local
  const resp = await fetch(localRuta);
  if (!resp.ok) throw new Error(`No se pudo cargar: ${localRuta} (HTTP ${resp.status})`);
  return resp.json();
}


// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Busca un usuario por nombre completo (usuario) y código (contraseña).
 * El nombre se usa como identificador de login según la configuración elegida.
 *
 * @param {string} nombreOExpediente - Nombre completo o número de expediente
 * @param {string} codigo            - Código de acceso
 * @returns {Promise<Object|null>}
 */
export async function buscarUsuario(nombreOExpediente, codigo) {
  if (!_usuariosCache) {
    _usuariosCache = await fetchConFallback(API_USUARIOS, RUTA_USUARIOS);
  }

  const termino    = nombreOExpediente.trim().toUpperCase();
  const codigoNorm = codigo.trim().toUpperCase();

  const encontrado = _usuariosCache.find(u => {
    const matchNombre     = (u.nombre             || '').toUpperCase() === termino;
    const matchExpediente = (u.numeroExpediente    || '').toUpperCase() === termino;
    const matchCodigo     = (u.codigo              || '').toUpperCase() === codigoNorm;
    const activo          = u.activo !== false;

    return (matchNombre || matchExpediente) && matchCodigo && activo;
  });

  return encontrado || null;
}


/**
 * Obtiene todas las canciones (evidencias) del expediente.
 *
 * @returns {Promise<Array>}
 */
export async function obtenerCanciones() {
  if (!_cancionesCache) {
    _cancionesCache = await fetchConFallback(API_CANCIONES, RUTA_CANCIONES);
  }
  return _cancionesCache;
}


/**
 * Obtiene una canción específica por su ID.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function obtenerCancionPorId(id) {
  const canciones = await obtenerCanciones();
  return canciones.find(c => Number(c.id) === Number(id)) || null;
}


/**
 * Invalida la cache en memoria (útil si los datos cambian durante la sesión).
 */
export function invalidarCache() {
  _usuariosCache  = null;
  _cancionesCache = null;
}


/**
 * Verifica si el api-server está configurado con Google Sheets.
 * Útil para mostrar indicadores de estado en el admin.
 *
 * @returns {Promise<{ok: boolean, configurado: Object}>}
 */
export async function verificarConexionSheets() {
  try {
    const resp = await fetch(API_STATUS, { signal: AbortSignal.timeout(4000) });
    if (resp.ok) return resp.json();
  } catch (_) {}
  return { ok: false, configurado: { GOOGLE_SHEETS_ID: false, GOOGLE_SERVICE_ACCOUNT: false } };
}


/**
 * Registra la evaluación del usuario.
 * En esta versión se guarda localmente; al conectar backend se hará INSERT real.
 *
 * @param {Object} evaluacion
 * @returns {Promise<{exito: boolean, mensaje: string}>}
 */
export async function registrarEvaluacion(evaluacion) {
  const registro = {
    ...evaluacion,
    fecha:      new Date().toISOString(),
    expediente: 'CSC-2026-MB'
  };

  safeStorage.setItem('evaluacion_registrada', JSON.stringify(registro));
  await new Promise(resolve => setTimeout(resolve, 1200));

  return {
    exito:   true,
    mensaje: 'EVALUACIÓN REGISTRADA. FOLIO ASIGNADO: EVAL-CSC-' + Date.now()
  };
}


/**
 * Registra una reacción (♡) del usuario en un momento específico de la canción.
 *
 * @param {number|string} cancionId - ID de la canción
 * @param {number}        timestamp - Segundo exacto en que se hizo clic
 * @returns {Promise<{exito: boolean}>}
 */
export async function registrarReaccion(cancionId, timestamp) {
  const reacciones = JSON.parse(safeStorage.getItem('reacciones') || '[]');
  reacciones.push({
    cancionId,
    timestamp,
    fecha: new Date().toISOString()
  });
  safeStorage.setItem('reacciones', JSON.stringify(reacciones));
  return { exito: true };
}


/**
 * Registra la calificación (1–10) individual de una canción.
 *
 * @param {number|string} cancionId   - ID de la canción
 * @param {number}        calificacion - Valor del 1 al 10
 * @returns {Promise<{exito: boolean}>}
 */
export async function registrarCalificacionCancion(cancionId, calificacion) {
  const califs = JSON.parse(safeStorage.getItem('calificaciones_canciones') || '{}');
  califs[cancionId] = { calificacion, fecha: new Date().toISOString() };
  safeStorage.setItem('calificaciones_canciones', JSON.stringify(califs));
  return { exito: true };
}


/**
 * Registra el último acceso del usuario.
 *
 * @param {number} usuarioId
 */
export async function registrarAcceso(usuarioId) {
  safeStorage.setItem('ultimo_acceso', JSON.stringify({
    usuarioId,
    fecha: new Date().toISOString()
  }));
}
