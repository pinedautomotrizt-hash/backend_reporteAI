import { env } from './infrastructure/config/env.js';
import { crearServidor } from './infrastructure/http/server.js';
import { crearGuardia } from './infrastructure/http/plugins/autenticacion.js';
import { ControlPersonalClient } from './infrastructure/external/control-personal/ControlPersonalClient.js';
import { ControlPersonalOrdenTrabajoAdapter } from './infrastructure/external/control-personal/ControlPersonalOrdenTrabajoAdapter.js';
import { ControlPersonalIdentidadAdapter } from './infrastructure/external/control-personal/ControlPersonalIdentidadAdapter.js';
import { JoseEmisorTokens } from './infrastructure/auth/JoseEmisorTokens.js';
import { crearPool } from './infrastructure/persistence/mysql/conexion.js';
import { migrar } from './infrastructure/persistence/mysql/migrar.js';
import { MySqlReporteRepository } from './infrastructure/persistence/mysql/MySqlReporteRepository.js';
import { DiscoLocalAlmacenamiento } from './infrastructure/storage/DiscoLocalAlmacenamiento.js';
import { SharpProcesadorImagenes } from './infrastructure/imagenes/SharpProcesadorImagenes.js';
import { MySqlInformeRepository } from './infrastructure/persistence/mysql/MySqlInformeRepository.js';
import { GeminiRedactorInforme } from './infrastructure/ia/GeminiRedactorInforme.js';
import { SinIaRedactorInforme } from './infrastructure/ia/SinIaRedactorInforme.js';
import { DocxGeneradorInforme } from './infrastructure/documentos/DocxGeneradorInforme.js';
import { GestionarInforme } from './application/use-cases/informes/GestionarInforme.js';
import { BuscarOrdenesTrabajo } from './application/use-cases/BuscarOrdenesTrabajo.js';
import { ObtenerOrdenTrabajo } from './application/use-cases/ObtenerOrdenTrabajo.js';
import { IniciarSesion } from './application/use-cases/IniciarSesion.js';
import { CrearReporte } from './application/use-cases/reportes/CrearReporte.js';
import { EditarReporte } from './application/use-cases/reportes/EditarReporte.js';
import { RevisarReporte } from './application/use-cases/reportes/RevisarReporte.js';
import { ConsultarReportes } from './application/use-cases/reportes/ConsultarReportes.js';

/**
 * COMPOSITION ROOT: el único lugar donde se eligen los adaptadores concretos
 * y se "enchufan" a los casos de uso.
 *
 *   Adaptadores (infraestructura) -> Casos de uso (aplicación) -> Rutas HTTP
 *
 * ¿Fotos a R2/Drive en vez de disco? Cambia solo la línea de `archivos`.
 */

// 1. Base de datos: conectar y aplicar migraciones pendientes
const pool = crearPool(env.DATABASE_URL);
await migrar(pool);

// 2. Adaptadores de salida
const controlPersonal = new ControlPersonalClient({
  baseUrl: env.CONTROL_PERSONAL_URL,
  email: env.CONTROL_PERSONAL_EMAIL,
  password: env.CONTROL_PERSONAL_PASSWORD,
});
const ordenesProvider = new ControlPersonalOrdenTrabajoAdapter(controlPersonal);
const identidad = new ControlPersonalIdentidadAdapter(controlPersonal);
const tokens = new JoseEmisorTokens(env.JWT_SECRET);
const reportesRepo = new MySqlReporteRepository(pool);
const archivos = new DiscoLocalAlmacenamiento(env.STORAGE_DIR, env.JWT_SECRET);
const imagenes = new SharpProcesadorImagenes();
const informesRepo = new MySqlInformeRepository(pool);
const documento = new DocxGeneradorInforme();
// Con clave -> Gemini; sin clave -> borrador con el texto del técnico (la app no se cae)
const redactor = env.GEMINI_API_KEY
  ? new GeminiRedactorInforme({
      apiKey: env.GEMINI_API_KEY,
      urlBase: env.GEMINI_URL_BASE,
      modelos: env.GEMINI_MODELOS,
      timeoutSegundos: env.GEMINI_TIMEOUT_SEGUNDOS,
    })
  : new SinIaRedactorInforme();
if (!env.GEMINI_API_KEY) console.warn('GEMINI_API_KEY vacío: los informes se generarán SIN IA');

// 3. Casos de uso: reciben puertos, no saben qué adaptador hay detrás
const iniciarSesion = new IniciarSesion(identidad, tokens, env.ROLES_JEFE);
const buscarOrdenesTrabajo = new BuscarOrdenesTrabajo(ordenesProvider);
const obtenerOrdenTrabajo = new ObtenerOrdenTrabajo(ordenesProvider);
const crearReporte = new CrearReporte(obtenerOrdenTrabajo, reportesRepo, archivos);
const editarReporte = new EditarReporte(reportesRepo, archivos, imagenes);
const revisarReporte = new RevisarReporte(reportesRepo, archivos);
const consultarReportes = new ConsultarReportes(reportesRepo, archivos);
const gestionarInforme = new GestionarInforme(reportesRepo, informesRepo, ordenesProvider, archivos, redactor, documento, {
  jefeNombre: env.INFORME_JEFE_NOMBRE,
  jefeCargo: env.INFORME_JEFE_CARGO,
  responsable: env.INFORME_RESPONSABLE,
});

// 4. Adaptador de entrada (HTTP)
const app = await crearServidor({
  iniciarSesion,
  buscarOrdenesTrabajo,
  obtenerOrdenTrabajo,
  crearReporte,
  editarReporte,
  revisarReporte,
  consultarReportes,
  gestionarInforme,
  requiereSesion: crearGuardia(tokens),
  almacenamientoLocal: archivos,
});

// Cierre ordenado (Railway envía SIGTERM al redesplegar)
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(senal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

// 0.0.0.0 es obligatorio en Railway (escuchar solo en localhost no funciona en contenedores)
await app.listen({ port: env.PORT, host: '0.0.0.0' });
