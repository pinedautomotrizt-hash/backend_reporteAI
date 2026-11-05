import type { OrdenTrabajo, OrdenTrabajoResumen } from '../../domain/entities/OrdenTrabajo.js';

/**
 * PUERTO DE SALIDA: "necesito obtener OTs de algún lado".
 *
 * La aplicación solo conoce esta interfaz. Hoy la implementa el adaptador
 * del sistema de Control de Personal; mañana podría ser otra API, una base
 * de datos o un mock para pruebas, sin cambiar los casos de uso.
 */
export interface OrdenTrabajoProvider {
  /** Busca por número de OT o por placa. */
  buscar(termino: string, limite: number): Promise<OrdenTrabajoResumen[]>;

  /** OT completa con sus actividades, o null si no existe. */
  obtenerPorId(id: number): Promise<OrdenTrabajo | null>;
}
