/**
 * sheets.ts — Proxy privado para Google Sheets
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo expone las rutas que el frontend llama para obtener y actualizar datos:
 *
 *   GET  /api/sheets/usuarios   — lista de usuarios del comité
 *   GET  /api/sheets/canciones  — lista de canciones con letras y créditos
 *   POST /api/sheets/geolock    — registra el país/IP en la columna GEOLOCK (BG)
 *   POST /api/sheets/track-play — registra eventos de reproducción de canciones
 *
 * Las credenciales de la cuenta de servicio NUNCA salen al navegador.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { google } from "googleapis";

const router: IRouter = Router();

// ── Cache simple en memoria para reducir llamadas a la API ───────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}


// ── Helper: obtener cliente autenticado de Google Sheets con lectura/escritura ─

function getSheetsClient() {
  const serviceAccountRaw = process.env["GOOGLE_SERVICE_ACCOUNT"];
  if (!serviceAccountRaw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT no está configurado.");
  }

  const credentials = JSON.parse(serviceAccountRaw);

  const auth = new google.auth.GoogleAuth({
    credentials,
    // Permisos completos de lectura y escritura para guardar GEOLOCK
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}


// ── Helper: convertir índice numérico de columna a letra A1 (ej. 58 -> BG) ────

function indexToColLetter(index: number): string {
  let temp = index + 1;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}


// ── Helper: leer una hoja y convertir a array de objetos ────────────────────

async function leerHoja(nombreHoja: string): Promise<Record<string, string>[]> {
  const spreadsheetId = process.env["GOOGLE_SHEETS_ID"];
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_ID no está configurado.");
  }

  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: nombreHoja,
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return [];

  // La primera fila son los encabezados
  const headers = rows[0] as string[];
  const datos   = rows.slice(1) as string[][];

  return datos
    .filter(row => row.some(cell => cell?.trim()))  // filtrar filas vacías
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header.trim()] = (row[i] ?? "").trim();
      });
      return obj;
    });
}


// ── Helper: actualizar celda específica de GEOLOCK por correo ────────────────

async function actualizarGEOLOCK(email: string, pais: string): Promise<boolean> {
  const spreadsheetId = process.env["GOOGLE_SHEETS_ID"];
  if (!spreadsheetId) return false;

  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "usuarios",
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return false;

  const headers = (rows[0] as string[]).map(h => (h || "").trim());

  // Buscar columna GEOLOCK (si no existe por nombre, se usa BG que es el índice 58)
  let colIndex = headers.findIndex(h => h.toUpperCase() === "GEOLOCK");
  let colLetter = "BG";

  if (colIndex !== -1) {
    colLetter = indexToColLetter(colIndex);
  }

  // Buscar columna de Email para emparejar al usuario
  let emailColIdx = headers.findIndex(h => h.toLowerCase() === "email");
  if (emailColIdx === -1) {
    emailColIdx = headers.findIndex(h => h.toLowerCase().includes("nombre"));
  }

  // Buscar la fila correspondiente al usuario
  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const cellVal = (rows[i][emailColIdx] || "").trim().toLowerCase();
    if (cellVal && cellVal === email.trim().toLowerCase()) {
      targetRowIndex = i + 1; // Fila real en Google Sheets (base 1)
      break;
    }
  }

  if (targetRowIndex === -1) return false;

  // Actualizar la celda exacta en Google Sheets
  const rangeToUpdate = `usuarios!${colLetter}${targetRowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: rangeToUpdate,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[pais]]
    }
  });

  return true;
}


// ── Mapeo de filas a objetos de usuario ─────────────────────────────────────

function mapearUsuario(row: Record<string, string>) {
  return {
    id:                   row["ID"]                 || "",
    numeroExpediente:     row["Nombre Completo"]    || "",   // login por nombre
    codigo:               row["Código"]             || "",
    nombre:               row["Nombre Completo"]    || "",
    tituloProfesional:    row["Título"]             || "",
    especialidad:         row["Especialidad"]       || "",
    categoria:            row["Consejo"]            || "",
    nivelAutorizacion:    row["Nivel"]              || "",
    pais:                 row["País"]               || "",
    estado:               row["Estado/Provincia"]   || "",
    ciudad:               row["Ciudad"]             || "",
    email:                row["Email"]              || "",
    telefono:             row["Teléfono"]           || "",
    fotografia:           row["Foto"]               || "",
    activo:               (row["Estado"] || "").toLowerCase() !== "inactivo",
    bio:                  row["Bio web"] || row["Notas"] || "",
    mensajePersonalizado: row["Mensaje personalizado"] || row["Notas"] || "",
    evaluacionRealizada: (row["Evaluación"] || "").toLowerCase() === "sí",
    ultimoAcceso:         row["Último acceso"]      || null,
    geolock:              row["GEOLOCK"]            || "",
  };
}


// ── Mapeo de filas a objetos de canción ──────────────────────────────────────

function mapearCancion(row: Record<string, string>) {
  return {
    id:        Number(row["ID"])    || 0,
    titulo:    row["Titulo"]        || row["Título"]    || "",
    subtitulo: row["Subtitulo"]     || row["Subtítulo"] || "",
    audio:     row["Audio"]         || "",
    historia:  row["Historia"]      || "",
    letra:     row["Letra"]         || "",
    creditos:  row["Creditos"]      || row["Créditos"]  || "",
  };
}


// ── Rutas ────────────────────────────────────────────────────────────────────

router.get("/usuarios", async (_req: Request, res: Response) => {
  try {
    const cached = getFromCache("usuarios");
    if (cached) {
      res.json({ ok: true, data: cached });
      return;
    }

    const filas    = await leerHoja("usuarios");
    const usuarios = filas.map(mapearUsuario);

    setCache("usuarios", usuarios);
    res.json({ ok: true, data: usuarios });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: mensaje });
  }
});


router.get("/canciones", async (_req: Request, res: Response) => {
  try {
    const cached = getFromCache("canciones");
    if (cached) {
      res.json({ ok: true, data: cached });
      return;
    }

    const filas     = await leerHoja("canciones");
    const canciones = filas.map(mapearCancion);

    setCache("canciones", canciones);
    res.json({ ok: true, data: canciones });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: mensaje });
  }
});


// ── Nueva Ruta: Guardar GEOLOCK en la Columna BG ─────────────────────────────

router.post("/geolock", async (req: Request, res: Response) => {
  try {
    const { email, country, ip } = req.body || {};
    if (!email) {
      res.status(400).json({ ok: false, error: "Falta el email del usuario." });
      return;
    }

    const textoUbicacion = country ? `${country}${ip ? ` [IP: ${ip}]` : ""}` : "Desconocido";
    const guardado = await actualizarGEOLOCK(email, textoUbicacion);

    if (guardado) {
      cache.delete("usuarios"); // Limpia cache para refrescar datos
    }

    res.json({ ok: true, registrado: guardado, ubicacion: textoUbicacion });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: mensaje });
  }
});


// ── Nueva Ruta: Registrar Reproducción de Canciones ─────────────────────────

router.post("/track-play", async (req: Request, res: Response) => {
  try {
    const { email, trackTitle, action } = req.body || {};
    console.log(`[REPRODUCCIÓN] Usuario: ${email || "Anónimo"} | Acción: ${action || "play"} | Canción: ${trackTitle}`);
    
    res.json({ ok: true, registrado: true });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: mensaje });
  }
});


// ── Ruta de diagnóstico ──────────────────────────────────────────────────────

router.get("/status", (_req: Request, res: Response) => {
  const tieneSheetId      = !!process.env["GOOGLE_SHEETS_ID"];
  const tieneCuentaServ  = !!process.env["GOOGLE_SERVICE_ACCOUNT"];

  res.json({
    ok: tieneSheetId && tieneCuentaServ,
    configurado: {
      GOOGLE_SHEETS_ID:       tieneSheetId,
      GOOGLE_SERVICE_ACCOUNT: tieneCuentaServ,
    },
  });
});

export default router;
