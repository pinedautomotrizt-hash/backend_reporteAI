import 'dotenv/config';
import { z } from 'zod';

/**
 * Lee y valida las variables de entorno al arrancar.
 * Si falta algo, la app falla de inmediato con un mensaje claro
 * (mejor que fallar a mitad de una petición en producción).
 * En Railway estas variables se configuran en la pestaña "Variables".
 */
const esquema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // URL(s) del frontend permitidas para CORS, separadas por coma
  // (ej. "https://reportes.up.railway.app,http://localhost:5180")
  FRONTEND_URL: z
    .string()
    .default('http://localhost:5180')
    .transform((s) => s.split(',').map((u) => u.trim().replace(/\/+$/, '')).filter(Boolean))
    .pipe(z.array(z.string().url('FRONTEND_URL debe contener URLs válidas'))),

  // Integración con el sistema de Control de Personal (OTs)
  CONTROL_PERSONAL_URL: z.string().url(),
  CONTROL_PERSONAL_EMAIL: z.string().email(),
  CONTROL_PERSONAL_PASSWORD: z.string().min(1),

  // Base de datos MySQL. En Railway: DATABASE_URL=${{MySQL.MYSQL_URL}}
  DATABASE_URL: z.string().startsWith('mysql://', 'DATABASE_URL debe empezar con mysql://'),

  // Carpeta donde se guardan las fotos. En Railway: la ruta del Volume (ej. /data/uploads)
  STORAGE_DIR: z.string().default('./uploads'),

  // IA para redactar informes (Google Gemini, igual que Control de Personal).
  // Sin GEMINI_API_KEY el informe se arma con el texto del técnico, sin IA.
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_URL_BASE: z.string().url().default('https://generativelanguage.googleapis.com/v1beta'),
  GEMINI_MODELOS: z
    .string()
    .default('gemini-flash-latest,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-lite-latest,gemini-3.5-flash-lite')
    .transform((s) => s.split(',').map((m) => m.trim()).filter(Boolean)),
  GEMINI_TIMEOUT_SEGUNDOS: z.coerce.number().default(90),

  // Datos que aparecen en el informe (firma y responsable)
  INFORME_JEFE_NOMBRE: z.string().default(''),
  INFORME_JEFE_CARGO: z.string().default('Jefe de taller'),
  INFORME_RESPONSABLE: z.string().default(''),
  // Sede a la que pertenecen la firma y el responsable de arriba. Los informes de
  // OTRAS sedes (ej. Callao) se firman con el jefe técnico que los genera.
  INFORME_SEDE: z.string().default('TRUJILLO').transform((s) => s.trim().toUpperCase()),
  // Nombre con el que sale cada sede en el informe: "CALLAO=LIMA" (varias separadas por coma).
  INFORME_SEDE_NOMBRES: z
    .string()
    .default('CALLAO=LIMA')
    .transform((s) =>
      Object.fromEntries(
        s.split(',').map((p) => p.split('=').map((x) => x.trim().toUpperCase())).filter(([a, b]) => a && b),
      ) as Record<string, string>,
    ),

  // Aviso AUTOMÁTICO por WhatsApp (CallMeBot) cuando un técnico envía su reporte.
  // APAGADO por defecto: solo se envía si CALLMEBOT_ACTIVO=true (además del número y la clave).
  CALLMEBOT_ACTIVO: z
    .string()
    .default('false')
    .transform((s) => ['true', '1', 'si', 'sí'].includes(s.trim().toLowerCase())),
  // WHATSAPP_AVISOS: número que activó CallMeBot, con código de país (ej. 51967313681).
  // CALLMEBOT_APIKEY: la clave que respondió el bot. Si falta alguno, no se envían avisos.
  WHATSAPP_AVISOS: z
    .string()
    .default('')
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => s === '' || (s.length >= 10 && s.length <= 15), 'WHATSAPP_AVISOS debe tener código de país, ej. 51967313681'),
  CALLMEBOT_APIKEY: z.string().trim().default(''),

  // Sesiones de esta app
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  // Roles de Control de Personal que entran como JEFE DE TALLER (separados por coma).
  // El admin ve todas las sedes; el jefe_tecnico solo la suya (Trujillo, Callao...).
  ROLES_JEFE: z
    .string()
    .default('admin,jefe_tecnico')
    .transform((s) => s.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)),
});

export const env = esquema.parse(process.env);
