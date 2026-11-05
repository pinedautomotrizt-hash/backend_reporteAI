import type { OrdenTrabajoProvider } from '../ports/OrdenTrabajoProvider.js';
import type { OrdenTrabajoResumen } from '../../domain/entities/OrdenTrabajo.js';
import { esJefe, type UsuarioSesion } from '../../domain/entities/Usuario.js';
import { Placa } from '../../domain/value-objects/Placa.js';
import { DomainError } from '../../domain/errors/DomainError.js';

/**
 * CASO DE USO: buscar OTs por número o placa.
 *
 * Reglas:
 *  - Si lo escrito parece placa ("bxq755", "BXQ 755") se normaliza a "BXQ-755".
 *  - El jefe de taller ve todas las OTs; el técnico solo las asignadas a él.
 */
export class BuscarOrdenesTrabajo {
  constructor(private readonly ordenes: OrdenTrabajoProvider) {}

  async ejecutar(usuario: UsuarioSesion, entrada: string, limite = 10): Promise<OrdenTrabajoResumen[]> {
    const termino = entrada.trim();
    if (termino.length < 3) {
      throw new DomainError('Escribe al menos 3 caracteres (número de OT o placa)');
    }
    limite = Math.min(limite, 50);

    if (esJefe(usuario)) {
      return this.ordenes.buscar(this.normalizar(termino), limite);
    }
    // Para técnicos se pide más y se filtra, para no perder sus OTs entre las de otros
    const todas = await this.ordenes.buscar(this.normalizar(termino), 50);
    return todas.filter((ot) => ot.tecnicoId === usuario.tecnicoId).slice(0, limite);
  }

  private normalizar(termino: string): string {
    try {
      return Placa.crear(termino).valor;
    } catch {
      return termino; // no es placa -> número de OT
    }
  }
}
