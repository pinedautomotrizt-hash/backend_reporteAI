import { randomUUID } from 'node:crypto';
import type { UsuarioSesion } from '../../../domain/entities/Usuario.js';
import { DomainError } from '../../../domain/errors/DomainError.js';
import type { ReporteRepository } from '../../ports/ReporteRepository.js';
import type { AlmacenamientoArchivos } from '../../ports/AlmacenamientoArchivos.js';
import type { ProcesadorImagenes } from '../../ports/ProcesadorImagenes.js';
import { reporteADTO } from '../../dto/ReporteDTO.js';
import { cargarReporte } from './cargarReporte.js';

export const MAX_BYTES_FOTO = 15 * 1024 * 1024; // 15 MB por foto (antes de procesar)

/**
 * CASOS DE USO del TÉCNICO sobre su reporte:
 * escribir el requerimiento, agregar/describir/quitar fotos y enviarlo al jefe.
 * Cada método: cargar -> aplicar regla del dominio -> guardar.
 */
export class EditarReporte {
  constructor(
    private readonly reportes: ReporteRepository,
    private readonly archivos: AlmacenamientoArchivos,
    private readonly imagenes: ProcesadorImagenes,
  ) {}

  async actualizarRequerimiento(u: UsuarioSesion, id: string, texto: string) {
    const r = await cargarReporte(this.reportes, u, id);
    r.actualizarRequerimiento(u, texto);
    await this.reportes.guardar(r);
    return reporteADTO(r, this.archivos);
  }

  async agregarFoto(u: UsuarioSesion, id: string, original: Buffer, descripcion: string) {
    if (original.length > MAX_BYTES_FOTO) throw new DomainError('La foto supera los 15 MB');

    const r = await cargarReporte(this.reportes, u, id);
    r.verificarEdicion(u); // antes de procesar la imagen: falla rápido si no puede

    const img = await this.imagenes.procesar(original);
    const fotoId = randomUUID();
    // Carpeta por placa y reporte: fácil de ubicar si algún día se revisa a mano
    const base = `reportes/${r.ot.placa}/${r.id}/${fotoId}`;
    const clave = `${base}.${img.principal.extension}`;
    const claveMiniatura = `${base}_min.${img.miniatura.extension}`;

    await this.archivos.guardar(clave, img.principal.datos, img.principal.tipo);
    await this.archivos.guardar(claveMiniatura, img.miniatura.datos, img.miniatura.tipo);

    try {
      r.agregarFoto(u, { id: fotoId, clave, claveMiniatura, descripcion, bytes: img.principal.datos.length });
      await this.reportes.guardar(r);
    } catch (e) {
      // Si la regla o la BD fallan, no dejamos archivos huérfanos
      await Promise.allSettled([this.archivos.eliminar(clave), this.archivos.eliminar(claveMiniatura)]);
      throw e;
    }
    return reporteADTO(r, this.archivos);
  }

  async describirFoto(u: UsuarioSesion, id: string, fotoId: string, descripcion: string) {
    const r = await cargarReporte(this.reportes, u, id);
    r.describirFoto(u, fotoId, descripcion);
    await this.reportes.guardar(r);
    return reporteADTO(r, this.archivos);
  }

  async quitarFoto(u: UsuarioSesion, id: string, fotoId: string) {
    const r = await cargarReporte(this.reportes, u, id);
    const foto = r.quitarFoto(u, fotoId);
    await this.reportes.guardar(r);
    await Promise.allSettled([this.archivos.eliminar(foto.clave), this.archivos.eliminar(foto.claveMiniatura)]);
    return reporteADTO(r, this.archivos);
  }

  async enviar(u: UsuarioSesion, id: string) {
    const r = await cargarReporte(this.reportes, u, id);
    r.enviar(u);
    await this.reportes.guardar(r);
    return reporteADTO(r, this.archivos);
  }
}
