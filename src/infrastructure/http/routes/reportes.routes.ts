import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CrearReporte } from '../../../application/use-cases/reportes/CrearReporte.js';
import type { EditarReporte } from '../../../application/use-cases/reportes/EditarReporte.js';
import type { RevisarReporte } from '../../../application/use-cases/reportes/RevisarReporte.js';
import type { ConsultarReportes } from '../../../application/use-cases/reportes/ConsultarReportes.js';
import { DomainError } from '../../../domain/errors/DomainError.js';
import { usuarioDe, type RequiereSesion } from '../plugins/autenticacion.js';

export interface ReportesDeps {
  crearReporte: CrearReporte;
  editarReporte: EditarReporte;
  revisarReporte: RevisarReporte;
  consultarReportes: ConsultarReportes;
  requiereSesion: RequiereSesion;
}

const ESTADOS = ['BORRADOR', 'ENVIADO', 'OBSERVADO', 'APROBADO'] as const;
const pId = z.object({ id: z.string().uuid('Id de reporte inválido') });
const pFoto = pId.extend({ fotoId: z.string().uuid('Id de foto inválido') });
const qHistorial = z.object({
  estado: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim().toUpperCase()) : undefined))
    .pipe(z.array(z.enum(ESTADOS)).optional()),
  placa: z.string().trim().optional(),
  tecnicoId: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().positive().optional(),
  porPagina: z.coerce.number().int().positive().optional(),
});

/**
 * Rutas de reportes (todas con sesión):
 *   POST   /api/reportes                      { otId }           crear / retomar
 *   GET    /api/reportes?estado=ENVIADO&placa=BXQ                 historial
 *   GET    /api/reportes/:id                                       detalle
 *   PATCH  /api/reportes/:id                  { requerimiento }
 *   POST   /api/reportes/:id/fotos            multipart: descripcion + archivo
 *   PATCH  /api/reportes/:id/fotos/:fotoId    { descripcion }
 *   DELETE /api/reportes/:id/fotos/:fotoId
 *   POST   /api/reportes/:id/enviar                                técnico -> jefe
 *   POST   /api/reportes/:id/aprobar          { comentario? }     solo jefe
 *   POST   /api/reportes/:id/observar         { comentario }      solo jefe
 */
export function reportesRoutes(deps: ReportesDeps) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', deps.requiereSesion());

    app.post('/api/reportes', async (req, reply) => {
      const { otId } = z.object({ otId: z.coerce.number().int().positive() }).parse(req.body);
      const r = await deps.crearReporte.ejecutar(usuarioDe(req), otId);
      return reply.status(r.creado ? 201 : 200).send(r.reporte);
    });

    app.get('/api/reportes', async (req) => deps.consultarReportes.historial(usuarioDe(req), qHistorial.parse(req.query)));

    app.get('/api/reportes/:id', async (req) => {
      const { id } = pId.parse(req.params);
      return deps.consultarReportes.detalle(usuarioDe(req), id);
    });

    app.patch('/api/reportes/:id', async (req) => {
      const { id } = pId.parse(req.params);
      const { requerimiento } = z.object({ requerimiento: z.string().max(5000) }).parse(req.body);
      return deps.editarReporte.actualizarRequerimiento(usuarioDe(req), id, requerimiento);
    });

    app.post('/api/reportes/:id/fotos', async (req) => {
      const { id } = pId.parse(req.params);
      const archivo = await req.file();
      if (!archivo) throw new DomainError('No se recibió ninguna foto');
      const datos = await archivo.toBuffer(); // si supera el límite, Fastify responde 413
      const campo = archivo.fields.descripcion;
      const descripcion = campo && 'value' in campo ? String(campo.value ?? '') : '';
      return deps.editarReporte.agregarFoto(usuarioDe(req), id, datos, descripcion);
    });

    app.patch('/api/reportes/:id/fotos/:fotoId', async (req) => {
      const { id, fotoId } = pFoto.parse(req.params);
      const { descripcion } = z.object({ descripcion: z.string().max(1000) }).parse(req.body);
      return deps.editarReporte.describirFoto(usuarioDe(req), id, fotoId, descripcion);
    });

    app.delete('/api/reportes/:id/fotos/:fotoId', async (req) => {
      const { id, fotoId } = pFoto.parse(req.params);
      return deps.editarReporte.quitarFoto(usuarioDe(req), id, fotoId);
    });

    app.post('/api/reportes/:id/enviar', async (req) => {
      const { id } = pId.parse(req.params);
      return deps.editarReporte.enviar(usuarioDe(req), id);
    });

    app.post('/api/reportes/:id/aprobar', { preHandler: deps.requiereSesion('JEFE_TALLER') }, async (req) => {
      const { id } = pId.parse(req.params);
      const { comentario } = z.object({ comentario: z.string().max(2000).optional() }).parse(req.body ?? {});
      return deps.revisarReporte.aprobar(usuarioDe(req), id, comentario);
    });

    app.post('/api/reportes/:id/observar', { preHandler: deps.requiereSesion('JEFE_TALLER') }, async (req) => {
      const { id } = pId.parse(req.params);
      const { comentario } = z.object({ comentario: z.string().max(2000) }).parse(req.body);
      return deps.revisarReporte.observar(usuarioDe(req), id, comentario);
    });
  };
}
