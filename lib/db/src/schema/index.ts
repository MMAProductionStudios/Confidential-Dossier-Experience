import { z } from "zod";

/**
 * Esquema principal del expediente / usuario en Google Sheets
 */
export const userCredentialSchema = z.object({
  email: z.string().email(),
  code: z.string().optional(),
  name: z.string().optional(),
  emailMessage: z.string().optional(),  // Columna BE
  webBio: z.string().optional(),        // Columna BF
  geolock: z.string().optional(),       // Columna BG (País de origen / IP)
});

export type UserCredential = z.infer<typeof userCredentialSchema>;

/**
 * Payload recibido desde la web al detectar la ubicación
 */
export const geolockUpdateSchema = z.object({
  email: z.string(),
  country: z.string(),
  ip: z.string().optional(),
});

export type GeolockUpdate = z.infer<typeof geolockUpdateSchema>;

/**
 * Payload para el registro de estadísticas de reproducción de audio
 */
export const audioTrackEventSchema = z.object({
  email: z.string(),
  trackId: z.string(),
  trackTitle: z.string(),
  action: z.enum(["play", "pause", "completed"]),
  durationSeconds: z.number().optional(),
  timestamp: z.string().optional(),
});

export type AudioTrackEvent = z.infer<typeof audioTrackEventSchema>;
