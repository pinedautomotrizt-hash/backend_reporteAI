import type { Reporte } from '../../domain/entities/Reporte.js';
import type { AlmacenamientoArchivos } from '../ports/AlmacenamientoArchivos.js';
import type { ResumenReporte } from '../ports/ReporteRepository.js';

/**
 * Lo que la aplicación devuelve hacia afuera (HTTP). Convierte las "claves"
 * internas de archivos en URLs temporales que el navegador puede abrir.
 */
export function reporteADTO(r: Reporte, archivos: AlmacenamientoArchivos) {
  const d = r.datos();
  return {
    id: d.id,
    estado: d.estado,
    editable: r.editable,
    ot: d.ot,
    tecnicoId: d.tecnicoId,
    tecnicoNombre: d.tecnicoNombre,
    usuarioId: d.usuarioId,
    requerimiento: d.requerimiento,
    creadoEn: d.creadoEn,
    actualizadoEn: d.actualizadoEn,
    enviadoEn: d.enviadoEn,
    fotos: [...d.fotos]
      .sort((a, b) => a.orden - b.orden)
      .map((f) => ({
        id: f.id,
        descripcion: f.descripcion,
        orden: f.orden,
        bytes: f.bytes,
        creadaEn: f.creadaEn,
        url: archivos.urlTemporal(f.clave),
        urlMiniatura: archivos.urlTemporal(f.claveMiniatura),
      })),
    historial: [...d.historial].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
  };
}

export function resumenADTO(r: ResumenReporte, archivos: AlmacenamientoArchivos) {
  const { claveMiniaturaPortada, ...resto } = r;
  return { ...resto, urlPortada: claveMiniaturaPortada ? archivos.urlTemporal(claveMiniaturaPortada) : null };
}

export type ReporteDTO = ReturnType<typeof reporteADTO>;
