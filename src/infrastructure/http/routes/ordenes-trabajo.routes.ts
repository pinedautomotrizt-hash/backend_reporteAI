import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { BuscarOrdenesTrabajo } from '../../../application/use-cases/BuscarOrdenesTrabajo.js';
import type { ObtenerOrdenTrabajo } from '../../../application/use-cases/ObtenerOrdenTrabajo.js';
import { usuarioDe, type RequiereSesion } from '../plugins/autenticacion.js';

export interface OrdenesTrabajoDeps {
  buscarOrdenesTrabajo: BuscarOrdenesTrabajo;
  obtenerOrdenTrabajo: ObtenerOrdenTrabajo;
  requiereSesion: RequiereSesion;
}

const queryBusqueda = z.object({
  busqueda: z.string().default(''),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});
const paramsId = z.object({ id: z.coerce.number().int().positive() });

/**
 * Gerson Flores Narciso 
 * Adaptador HTTP de OTs. Solo traduce HTTP <-> caso de uso; no tiene lógica.
 *   GET /api/ordenes-trabajo?busqueda=BXQ-755
 *   GET /api/ordenes-trabajo/1298
 */
export function ordenesTrabajoRoutes(deps: OrdenesTrabajoDeps) {
  return async (app: FastifyInstance) => {
    // Todas las rutas de este bloque exigen sesión iniciada
    app.addHook('preHandler', deps.requiereSesion());

    app.get('/api/ordenes-trabajo', async (req) => {
      const { busqueda, limite } = queryBusqueda.parse(req.query);
      return deps.buscarOrdenesTrabajo.ejecutar(usuarioDe(req), busqueda, limite);
    });

    app.get('/api/ordenes-trabajo/:id', async (req) => {
      const { id } = paramsId.parse(req.params);
      return deps.obtenerOrdenTrabajo.ejecutar(usuarioDe(req), id);
    });
  };
}
