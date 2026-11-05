import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DiscoLocalAlmacenamiento } from '../../storage/DiscoLocalAlmacenamiento.js';

/**
 * Entrega fotos guardadas en disco: GET /api/archivos/<clave>?exp=..&firma=..
 * No pide sesión (un <img> no puede mandar el token) pero sí una firma
 * válida y vigente, que solo genera el backend para quien puede ver el reporte.
 * Si en el futuro se usa R2/S3, esta ruta deja de ser necesaria.
 */
export function archivosRoutes(almacenamiento: DiscoLocalAlmacenamiento) {
  return async (app: FastifyInstance) => {
    app.get('/api/archivos/*', async (req, reply) => {
      const clave = (req.params as { '*': string })['*'];
      const { exp, firma } = z.object({ exp: z.coerce.number(), firma: z.string() }).parse(req.query);

      if (!almacenamiento.firmaValida(clave, exp, firma)) {
        return reply.status(403).send({ error: 'Enlace vencido o inválido. Recarga la página.' });
      }
      const archivo = await almacenamiento.leer(clave);
      if (!archivo) return reply.status(404).send({ error: 'Archivo no encontrado' });

      return reply
        .header('Content-Type', archivo.tipo)
        .header('Content-Length', archivo.bytes)
        .header('Cache-Control', 'private, max-age=3600')
        .send(archivo.contenido);
    });
  };
}
