import type { UsuarioSesion } from '../../../domain/entities/Usuario.js';
import type { ReporteRepository } from '../../ports/ReporteRepository.js';
import type { AlmacenamientoArchivos } from '../../ports/AlmacenamientoArchivos.js';
import { reporteADTO } from '../../dto/ReporteDTO.js';
import { cargarReporte } from './cargarReporte.js';

/** CASOS DE USO del JEFE: aprobar o devolver (observar) un reporte enviado. */
export class RevisarReporte {
  constructor(
    private readonly reportes: ReporteRepository,
    private readonly archivos: AlmacenamientoArchivos,
  ) {}

  async aprobar(jefe: UsuarioSesion, id: string, comentario?: string) {
    const r = await cargarReporte(this.reportes, jefe, id);
    r.aprobar(jefe, comentario);
    await this.reportes.guardar(r);
    return reporteADTO(r, this.archivos);
  }

  async observar(jefe: UsuarioSesion, id: string, comentario: string) {
    const r = await cargarReporte(this.reportes, jefe, id);
    r.observar(jefe, comentario);
    await this.reportes.guardar(r);
    return reporteADTO(r, this.archivos);
  }
}
