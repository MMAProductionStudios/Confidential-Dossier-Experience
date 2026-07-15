/**
 * sheets.ts — Proxy privado para Google Sheets
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo expone dos rutas que el frontend llama para obtener datos:
 *
 *   GET /api/sheets/usuarios  — lista de usuarios del comité
 *   GET /api/sheets/canciones — lista de canciones con letras y créditos
 *
 * Las credenciales de la cuenta de servicio NUNCA salen al navegador.
 * Se leen desde variables de entorno:
 *   GOOGLE_SHEETS_ID          — ID del spreadsheet
 *   GOOGLE_SERVICE_ACCOUNT    — JSON completo de la cuenta de servicio (string)
 *
 * Nombres de pestañas esperados en el spreadsheet:
 *   "usuarios"  — hoja de miembros del comité
 *   "canciones" — hoja de canciones / letras
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


// ── Helper: obtener cliente autenticado de Google Sheets ─────────────────────

function getSheetsClient() {
  const serviceAccountRaw = process.env["GOOGLE_SERVICE_ACCOUNT"];
  if (!serviceAccountRaw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT no está configurado.");
  }

  const credentials = JSON.parse(serviceAccountRaw);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
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


// ── Mapeo de filas a objetos de usuario ─────────────────────────────────────

/**
 * Convierte una fila de la hoja "usuarios" al formato que espera el frontend.
 *
 * Columnas esperadas (basadas en el diseño del usuario):
 *   ID, Expediente, Código, Nombre Completo, Título, Especialidad,
 *   Consejo, Nivel, País, Estado/Provincia, Ciudad, Email, Teléfono,
 *   Foto, Estado, Último acceso, Evaluación, Entrega expediente, Notas
 */
function mapearUsuario(row: Record<string, string>) {
  return {
    id:                  row["ID"]                || "",
    numeroExpediente:    row["Nombre Completo"]   || "",   // login por nombre
    codigo:              row["Código"]            || "",
    nombre:              row["Nombre Completo"]   || "",
    tituloProfesional:   row["Título"]            || "",
    especialidad:        row["Especialidad"]      || "",
    categoria:           row["Consejo"]           || "",
    nivelAutorizacion:   row["Nivel"]             || "",
    pais:                row["País"]              || "",
    estado:              row["Estado/Provincia"]  || "",
    ciudad:              row["Ciudad"]            || "",
    email:               row["Email"]             || "",
    telefono:            row["Teléfono"]          || "",
    fotografia:          row["Foto"]              || "",
    activo:              (row["Estado"] || "").toLowerCase() !== "inactivo",
    bio:                 row["Notas"]             || "",
    mensajePersonalizado: row["Mensaje personalizado"] || row["Notas"] || "",
    evaluacionRealizada: (row["Evaluación"] || "").toLowerCase() === "sí",
    ultimoAcceso:        row["Último acceso"]     || null,
  };
}


// ── Mapeo de filas a objetos de canción ──────────────────────────────────────

/**
 * Convierte una fila de la hoja "canciones" al formato que espera el frontend.
 *
 * Columnas esperadas en la hoja "canciones":
 *   ID, Titulo, Subtitulo, Audio, Historia, Letra, Creditos
 */
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

    const filas    = await leerHoja("canciones");
    const canciones = filas.map(mapearCancion);

    setCache("canciones", canciones);
    res.json({ ok: true, data: canciones });
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: mensaje });
  }
});


// ── Ruta de diagnóstico (verifica configuración sin exponer credenciales) ────

router.get("/status", (_req: Request, res: Response) => {
  const tieneSheetId     = !!process.env["GOOGLE_SHEETS_ID"];
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
