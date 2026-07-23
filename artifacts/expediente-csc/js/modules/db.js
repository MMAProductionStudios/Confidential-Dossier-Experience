export async function buscarUsuario(nombreOExpediente, codigo) {
  if (!_usuariosCache) {
    _usuariosCache = await fetchConFallback(API_USUARIOS, RUTA_USUARIOS);
  }

  const termino    = nombreOExpediente.trim().toUpperCase();
  const codigoNorm = codigo.trim().toUpperCase();

  const encontrado = _usuariosCache.find(u => {
    const matchNombre     = (u.nombre_completo    || '').toUpperCase() === termino;
    const matchExpediente = (u.numero_expediente  || '').toUpperCase() === termino;
    const matchCodigo     = (u.codigo             || '').toUpperCase() === codigoNorm;
    
    // Valida contra la columna 'estado' (asumiendo que activo es cuando no dice INACTIVO)
    const activo          = (u.estado            || '').toUpperCase() !== 'INACTIVO';

    return (matchNombre || matchExpediente) && matchCodigo && activo;
  });

  return encontrado || null;
}
