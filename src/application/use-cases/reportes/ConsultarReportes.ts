import type { EstadoReporte } from '../../../domain/entities/Reporte.js';
import { esJefe, type UsuarioSesion } from '../../../domain/entities/Usuario.js';
import { Placa } from '../../../domain/value-objects/Placa.js';
import type { FiltroReportes, ReporteRepository } from '../../ports/ReporteRepository.js';
import type { AlmacenamientoArchivos } from '../../ports/AlmacenamientoArchivos.js';
import { reporteADTO, resumenADTO } from '../../dto/ReporteDTO.js';
import { cargarReporte } from './cargarReporte.js';

export interface ConsultaHistorial {
  estados?: EstadoReporte[];
  placa?: string;
  tecnicoId?: number;
  pagina?: number;
  porPagina?: number;
}

/**
 * CASOS DE USO de consulta:
 *  - Técnico: "mi perfil" -> todos SUS reportes (incluye borradores).
 *  - Jefe: historial de TODOS los técnicos (sin borradores ajenos).
 */
export class ConsultarReportes {
  constructor(
    private readonly reportes: ReporteRepository,
    private readonly archivos: AlmacenamientoArchivos,
  ) {}

  async historial(u: UsuarioSesion, q: ConsultaHistorial) {
    const porPagina = Math.min(q.porPagina ?? 20, 100);
    const pagina = Math.max(q.pagina ?? 1, 1);

    const filtro: FiltroReportes = {
      estados: q.estados?.length ? q.estados : undefined,
      placa: q.placa ? this.normalizarPlaca(q.placa) : undefined,
      limite: porPagina,
      desde: (pagina - 1) * porPagina,
    };
    if (esJefe(u)) {
      filtro.excluirBorradores = true;
      filtro.tecnicoId = q.tecnicoId;
    } else {
      filtro.usuarioId = u.id; // el técnico solo ve lo suyo, sin importar lo que pida
    }

    const { items, total } = await this.reportes.listar(filtro);
    return { items: items.map((i) => resumenADTO(i, this.archivos)), total, pagina, porPagina };
  }

  async detalle(u: UsuarioSesion, id: string) {
    return reporteADTO(await cargarReporte(this.reportes, u, id), this.archivos);
  }

  private normalizarPlaca(p: string) {
    try {
      return Placa.crear(p).valor;
    } catch {
      return p.trim().toUpperCase();
    }
  }
}
