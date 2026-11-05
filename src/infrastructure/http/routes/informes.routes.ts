import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GestionarInforme } from '../../../application/use-cases/informes/GestionarInforme.js';
import { usuarioDe, type RequiereSesion } from '../plugins/autenticacion.js';

export interface InformesDeps {
  gestionarInforme: GestionarInforme;
  requiereSesion: RequiereSesion;
}

const pId = z.object({ id: z.string().uuid('Id de reporte inválido') });
const item = z.object({ descripcion: z.string().max(300), cantidad: z.string().max(30) });
const texto = (max: number) => z.string().max(max);

/** Lo que el jefe puede editar del borrador (se valida todo lo que llega). */
const contenido = z.object({
  motivo: texto(150), sede: texto(60), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  responsable: texto(120), nroOrden: texto(30), tituloFotoPrincipal: texto(80),
  marca: texto(80), modelo: texto(120), placa: texto(15), vin: texto(40), kilometraje: texto(20),
  anioModelo: texto(10), fechaIngreso: texto(20), cliente: texto(200), vozCliente: texto(500),
  condicion: texto(2000), historial: texto(2000), diagnosticoIntro: texto(500),
  observaciones: z.array(texto(500)).max(30), conclusion: texto(1000), recomendaciones: z.array(texto(500)).max(20),
  repuestos: z.array(item).max(60), manoObra: z.array(item).max(30),
  fotoPrincipalId: z.string().uuid().nullable(),
  fotos: z.array(z.object({ fotoId: z.string().uuid(), leyenda: texto(200) })).max(20),
  jefeNombre: texto(120), jefeCargo: texto(120), tecnicoNombre: texto(150),
});

/**
 * Informe técnico (solo jefe de taller):
 *   GET  /api/reportes/:id/informe          borrador guardado
 *   POST /api/reportes/:id/informe/generar  la IA redacta (o vuelve a redactar)
 *   PUT  /api/reportes/:id/informe          guardar cambios del jefe
 *   GET  /api/reportes/:id/informe/word     descargar .docx
 */
export function informesRoutes(deps: InformesDeps) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', deps.requiereSesion('JEFE_TALLER'));

    app.get('/api/reportes/:id/informe', async (req) =>
      deps.gestionarInforme.obtener(usuarioDe(req), pId.parse(req.params).id));

    app.post('/api/reportes/:id/informe/generar', async (req) =>
      deps.gestionarInforme.generar(usuarioDe(req), pId.parse(req.params).id));

    app.put('/api/reportes/:id/informe', async (req) =>
      deps.gestionarInforme.guardar(usuarioDe(req), pId.parse(req.params).id, contenido.parse(req.body)));

    app.get('/api/reportes/:id/informe/word', async (req, reply) => {
      const doc = await deps.gestionarInforme.descargar(usuarioDe(req), pId.parse(req.params).id);
      return reply
        .header('Content-Type', doc.tipo)
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.nombre)}`)
        .send(doc.datos);
    });
  };
}
