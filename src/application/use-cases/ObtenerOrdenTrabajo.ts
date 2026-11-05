import type { OrdenTrabajoProvider } from '../ports/OrdenTrabajoProvider.js';
import type { OrdenTrabajo } from '../../domain/entities/OrdenTrabajo.js';
import { esJefe, type UsuarioSesion } from '../../domain/entities/Usuario.js';
import { RecursoNoEncontradoError } from '../../domain/errors/RecursoNoEncontradoError.js';
import { AccesoDenegadoError } from '../../domain/errors/AuthErrors.js';

/** CASO DE USO: ver la OT completa (vehículo, cliente, actividades). */
export class ObtenerOrdenTrabajo {
  constructor(private readonly ordenes: OrdenTrabajoProvider) {}

  async ejecutar(usuario: UsuarioSesion, id: number): Promise<OrdenTrabajo> {
    const ot = await this.ordenes.obtenerPorId(id);
    if (!ot) throw new RecursoNoEncontradoError(`No existe la OT con id ${id}`);

    if (!esJefe(usuario) && ot.tecnicoId !== usuario.tecnicoId) {
      throw new AccesoDenegadoError('Esta OT no está asignada a ti');
    }
    return ot;
  }
}
