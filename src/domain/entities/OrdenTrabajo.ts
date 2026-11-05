/**
 * Orden de Trabajo (OT) tal como la entiende ESTA aplicación.
 *
 * No es una copia del sistema de Control de Personal: solo tiene lo que
 * necesitamos para los reportes e informes técnicos. Datos financieros
 * (costos, utilidad, precios) se quedan fuera a propósito.
 */
export interface Vehiculo {
  placa: string;
  marca: string;
  modelo: string;
  version: string | null;
  vin: string | null; // chasis
  motor: string | null;
  anio: number | null;
  kilometraje: number | null;
}

export interface Cliente {
  codigo: string | null; // RUC / DNI
  nombre: string;
  grupo: string | null;
}

export type TipoActividad = 'SERVICIO' | 'REPUESTO' | 'OTRO';

export interface ActividadOT {
  tipo: TipoActividad;
  codigo: string;
  descripcion: string;
  cantidad: number;
}

/** Datos resumidos: para listas y búsquedas */
export interface OrdenTrabajoResumen {
  id: number;
  nroOrden: string;
  fechaApertura: string | null;
  estado: string;
  servicio: string | null; // ej. "MANTENIMIENTO 135,000 KM"
  placa: string;
  vehiculo: string; // "MITSUBISHI L200"
  clienteNombre: string;
  tecnicoId: number | null;
  tecnicoNombre: string | null;
}

/** OT completa: para crear el reporte y, después, el informe con IA */
export interface OrdenTrabajo {
  id: number;
  nroOrden: string;
  local: string | null;
  estado: string;
  fechaApertura: string | null;
  fechaCierre: string | null;
  servicio: string | null;
  tipoOt: string | null;
  asesor: string | null;
  tecnicoId: number | null;
  tecnicoNombre: string | null;
  vehiculo: Vehiculo;
  cliente: Cliente;
  actividades: ActividadOT[];
}
