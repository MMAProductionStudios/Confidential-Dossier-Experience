/**
 * db.js — Módulo de Base de Datos
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA DE ABSTRACCIÓN DE DATOS — EXPEDIENTE CSC-2026-MB
 *
 * Este módulo simula una capa de acceso a datos utilizando archivos JSON locales.
 * La arquitectura está diseñada para facilitar la migración posterior a
 * Supabase, Firebase, o cualquier backend REST/GraphQL.
 *
 * PARA MIGRAR A SUPABASE:
 *   1. Reemplazar fetchJSON() por llamadas a supabase.from('tabla').select()
 *   2. Reemplazar buscarUsuario() por consultas con filtros de Supabase
 *   3. Reemplazar registrarEvaluacion() por INSERT con supabase.from('evaluaciones').insert()
 *   4. El resto de la aplicación no necesita modificarse.
 *
 * PARA MIGRAR A FIREBASE:
 *   1. Reemplazar fetchJSON() por consultas a Firestore
 *   2. Usar collection() y where() para filtrar registros
 *   3. El contrato de datos (objetos retornados) debe mantenerse igual.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Configuración de rutas de los archivos de datos ─────────────────────────
// Al migrar a Supabase/Firebase, estas constantes dejarían de usarse.
const RUTA_USUARIOS  = './data/usuarios.json';
const RUTA_CANCIONES = './data/canciones.json';


/**
 * Recupera un archivo JSON desde una ruta relativa.
 * Esta función actúa como la "conexión a la base de datos".
 *
 * @param {string} ruta - Ruta relativa al archivo JSON
 * @returns {Promise<Array|Object>} — Datos parseados del archivo JSON
 * @throws {Error} si el archivo no existe o no es JSON válido
 */
async function fetchJSON(ruta) {
  const respuesta = await fetch(ruta);

  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar: ${ruta} (HTTP ${respuesta.status})`);
  }

  return respuesta.json();
}


/**
 * Busca un usuario en la base de datos por número de expediente y código.
 *
 * Equivalente Supabase:
 *   const { data } = await supabase
 *     .from('usuarios')
 *     .select('*')
 *     .eq('numeroExpediente', numeroExpediente)
 *     .eq('codigo', codigo)
 *     .eq('activo', true)
 *     .single();
 *
 * @param {string} numeroExpediente - Número de expediente (ej: "CSC-2026-MB-001")
 * @param {string} codigo - Código de autorización (ej: "JLG26001")
 * @returns {Promise<Object|null>} — Registro del usuario o null si no encontrado
 */
export async function buscarUsuario(numeroExpediente, codigo) {
  const usuarios = await fetchJSON(RUTA_USUARIOS);

  // Normalizar para comparación: eliminar espacios, convertir a mayúsculas
  const expNorm    = numeroExpediente.trim().toUpperCase();
  const codigoNorm = codigo.trim().toUpperCase();

  const encontrado = usuarios.find(u =>
    u.numeroExpediente.toUpperCase() === expNorm &&
    u.codigo.toUpperCase()           === codigoNorm &&
    u.activo === true
  );

  return encontrado || null;
}


/**
 * Obtiene todas las canciones (evidencias) del expediente.
 *
 * Equivalente Supabase:
 *   const { data } = await supabase
 *     .from('canciones')
 *     .select('*')
 *     .order('id');
 *
 * @returns {Promise<Array>} — Array de objetos canción
 */
export async function obtenerCanciones() {
  return fetchJSON(RUTA_CANCIONES);
}


/**
 * Obtiene una canción específica por su ID.
 *
 * @param {number} id - ID de la canción
 * @returns {Promise<Object|null>} — Objeto canción o null
 */
export async function obtenerCancionPorId(id) {
  const canciones = await fetchJSON(RUTA_CANCIONES);
  return canciones.find(c => c.id === id) || null;
}


/**
 * Registra la evaluación del usuario.
 *
 * NOTA: En esta versión de simulación JSON, el registro se almacena únicamente
 * en sessionStorage. Al migrar a Supabase, este método hará un INSERT real.
 *
 * Equivalente Supabase:
 *   const { data, error } = await supabase
 *     .from('evaluaciones')
 *     .insert({
 *       usuario_id:      evaluacion.usuarioId,
 *       calificacion:    evaluacion.calificacion,
 *       observaciones:   evaluacion.observaciones,
 *       fortalezas:      evaluacion.fortalezas,
 *       mejoras:         evaluacion.mejoras,
 *       comentarioFinal: evaluacion.comentarioFinal,
 *       fecha:           new Date().toISOString()
 *     });
 *
 * @param {Object} evaluacion - Objeto con los datos de la evaluación
 * @param {number} evaluacion.usuarioId       - ID del evaluador
 * @param {number} evaluacion.calificacion    - Puntuación del 1 al 10
 * @param {string} evaluacion.observaciones   - Observaciones generales
 * @param {string} evaluacion.fortalezas      - Fortalezas identificadas
 * @param {string} evaluacion.mejoras         - Aspectos a mejorar
 * @param {string} evaluacion.comentarioFinal - Dictamen final
 * @returns {Promise<{exito: boolean, mensaje: string}>}
 */
export async function registrarEvaluacion(evaluacion) {
  // Simulación: guardar en sessionStorage hasta conectar backend real
  const registro = {
    ...evaluacion,
    fecha:     new Date().toISOString(),
    expediente: 'CSC-2026-MB'
  };

  // Persistir en sesión del navegador
  sessionStorage.setItem('evaluacion_registrada', JSON.stringify(registro));

  // Simular latencia de red para efecto institucional realista
  await new Promise(resolve => setTimeout(resolve, 1200));

  return {
    exito:   true,
    mensaje: 'EVALUACIÓN REGISTRADA. FOLIO ASIGNADO: EVAL-CSC-' + Date.now()
  };
}


/**
 * Actualiza el campo ultimoAcceso del usuario en sessionStorage.
 * Al migrar a Supabase, hará un UPDATE real en la base de datos.
 *
 * Equivalente Supabase:
 *   await supabase
 *     .from('usuarios')
 *     .update({ ultimoAcceso: new Date().toISOString() })
 *     .eq('id', usuarioId);
 *
 * @param {number} usuarioId - ID del usuario a actualizar
 */
export async function registrarAcceso(usuarioId) {
  // En modo JSON simulado: solo registrar en sessionStorage
  const acceso = {
    usuarioId,
    fecha: new Date().toISOString()
  };
  sessionStorage.setItem('ultimo_acceso', JSON.stringify(acceso));
}
