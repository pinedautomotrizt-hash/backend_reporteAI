import type { EstadoReporte, Reporte } from '../../domain/entities/Reporte.js';

/** Filtros para el historial (técnico: los suyos; jefe: todos los enviados). */
export interface FiltroReportes {
  usuarioId?: number; // solo los creados por este usuario
  excluirBorradores?: boolean; // el jefe no ve borradores ajenos
  estados?: EstadoReporte[];
  placa?: string;
  tecnicoId?: number;
  limite: number;
  desde: number; // offset para paginar
}

/** Fila liviana para listas (sin cargar todas las fotos). */
export interface ResumenReporte {
  id: string;
  estado: EstadoReporte;
  otId: number;
  nroOrden: string;
  placa: string;
  vehiculo: string;
  servicio: string | null;
  clienteNombre: string;
  tecnicoId: number;
  tecnicoNombre: string;
  requerimiento: string;
  totalFotos: number;
  claveMiniaturaPortada: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  enviadoEn: Date | null;
}

/** PUERTO DE SALIDA: dónde se guardan los reportes (hoy MySQL). */
export interface ReporteRepository {
  guardar(reporte: Reporte): Promise<void>;
  obtener(id: string): Promise<Reporte | null>;
  /** Reporte aún editable (BORRADOR/OBSERVADO) de ese usuario para esa OT. */
  buscarAbierto(usuarioId: number, otId: number): Promise<Reporte | null>;
  listar(filtro: FiltroReportes): Promise<{ items: ResumenReporte[]; total: number }>;
}
