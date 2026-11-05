import { Reporte } from '../../../domain/entities/Reporte.js';
import type { UsuarioSesion } from '../../../domain/entities/Usuario.js';
import type { ReporteRepository } from '../../ports/ReporteRepository.js';
import type { AlmacenamientoArchivos } from '../../ports/AlmacenamientoArchivos.js';
import type { ObtenerOrdenTrabajo } from '../ObtenerOrdenTrabajo.js';
import { reporteADTO } from '../../dto/ReporteDTO.js';

/**
 * CASO DE USO: iniciar un reporte para una OT.
 *  - Reutiliza ObtenerOrdenTrabajo, así se respeta la misma regla de acceso
 *    (el técnico solo puede reportar sus OTs).
 *  - Si ya tiene un reporte abierto para esa OT, lo devuelve (no duplica).
 *  - Copia los datos del vehículo: el historial queda fijo aunque la OT cambie.
 */
export class CrearReporte {
  constructor(
    private readonly obtenerOT: ObtenerOrdenTrabajo,
    private readonly reportes: ReporteRepository,
    private readonly archivos: AlmacenamientoArchivos,
  ) {}

  async ejecutar(usuario: UsuarioSesion, otId: number) {
    const ot = await this.obtenerOT.ejecutar(usuario, otId);

    const abierto = await this.reportes.buscarAbierto(usuario.id, ot.id);
    if (abierto) return { creado: false, reporte: reporteADTO(abierto, this.archivos) };

    const v = ot.vehiculo;
    const reporte = Reporte.crear(
      {
        otId: ot.id,
        nroOrden: ot.nroOrden,
        placa: v.placa,
        vehiculo: [v.marca, v.modelo, v.version].filter(Boolean).join(' '),
        vin: v.vin,
        anio: v.anio,
        kilometraje: v.kilometraje,
        servicio: ot.servicio,
        clienteNombre: ot.cliente.nombre,
      },
      usuario,
      {
        id: usuario.tecnicoId ?? ot.tecnicoId ?? 0,
        nombre: usuario.tecnicoId ? usuario.nombre : (ot.tecnicoNombre ?? usuario.nombre),
      },
    );
    await this.reportes.guardar(reporte);
    return { creado: true, reporte: reporteADTO(reporte, this.archivos) };
  }
}
