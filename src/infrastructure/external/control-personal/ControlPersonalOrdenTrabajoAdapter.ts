import type { OrdenTrabajoProvider } from '../../../application/ports/OrdenTrabajoProvider.js';
import type {
  ActividadOT,
  OrdenTrabajo,
  OrdenTrabajoResumen,
  TipoActividad,
} from '../../../domain/entities/OrdenTrabajo.js';
import type { ControlPersonalClient } from './ControlPersonalClient.js';

/**
 * ADAPTADOR: implementa el puerto OrdenTrabajoProvider usando la API
 * de Control de Personal.
 *
 * Su trabajo principal es TRADUCIR: los nombres de campos de la API externa
 * (nroOrden, chasis, anioModelo, origenCodigo...) se convierten al modelo
 * del dominio. Si la API externa cambia, solo se ajusta este archivo.
 */

// ---- Forma de los datos en la API externa (solo los campos que usamos) ----
interface OtApi {
  id: number;
  nroOrden: string;
  localNombre: string | null;
  estado: string;
  fechaApertura: string | null;
  fechaCierre: string | null;
  grupoServicio: string | null;
  tipoOtOriginal: string | null;
  asesor: string | null;
  tecnicoId: number | null;
  tecnicoNombre: string | null;
  clienteCodigo: string | null;
  clienteNombre: string;
  grupoCliente: string | null;
  placa: string;
  chasis: string | null;
  motor: string | null;
  marca: string;
  modelo: string;
  version: string | null;
  anioModelo: number | null;
  anioFabricacion: number | null;
  kilometraje: number | null;
}

interface DetalleApi {
  origenCodigo: string;
  codigoActividad: string;
  actividad: string;
  cantidad: number;
}

interface PaginaApi<T> {
  content: T[];
}

export class ControlPersonalOrdenTrabajoAdapter implements OrdenTrabajoProvider {
  constructor(private readonly client: ControlPersonalClient) {}

  async buscar(termino: string, limite: number): Promise<OrdenTrabajoResumen[]> {
    const qs = new URLSearchParams({ busqueda: termino, page: '0', size: String(limite) });
    const pagina = await this.client.get<PaginaApi<OtApi>>(`/api/ordenes-trabajo?${qs}`);
    return (pagina?.content ?? []).map(aResumen);
  }

  async obtenerPorId(id: number): Promise<OrdenTrabajo | null> {
    const [ot, detalle] = await Promise.all([
      this.client.get<OtApi>(`/api/ordenes-trabajo/${id}`),
      this.client.get<DetalleApi[]>(`/api/ordenes-trabajo/${id}/detalle`),
    ]);
    if (!ot) return null;

    return {
      id: ot.id,
      nroOrden: ot.nroOrden,
      local: ot.localNombre,
      estado: ot.estado,
      fechaApertura: ot.fechaApertura,
      fechaCierre: ot.fechaCierre,
      servicio: ot.grupoServicio,
      tipoOt: ot.tipoOtOriginal,
      asesor: ot.asesor,
      tecnicoId: ot.tecnicoId,
      tecnicoNombre: ot.tecnicoNombre,
      vehiculo: {
        placa: ot.placa,
        marca: ot.marca,
        modelo: ot.modelo,
        version: ot.version,
        vin: ot.chasis,
        motor: ot.motor,
        anio: ot.anioModelo ?? ot.anioFabricacion,
        kilometraje: ot.kilometraje,
      },
      cliente: { codigo: ot.clienteCodigo, nombre: ot.clienteNombre, grupo: ot.grupoCliente },
      actividades: (detalle ?? []).map(aActividad),
    };
  }
}

function aResumen(ot: OtApi): OrdenTrabajoResumen {
  return {
    id: ot.id,
    nroOrden: ot.nroOrden,
    fechaApertura: ot.fechaApertura,
    estado: ot.estado,
    servicio: ot.grupoServicio,
    placa: ot.placa,
    vehiculo: `${ot.marca} ${ot.modelo}`.trim(),
    clienteNombre: ot.clienteNombre,
    tecnicoId: ot.tecnicoId,
    tecnicoNombre: ot.tecnicoNombre,
  };
}

function aActividad(d: DetalleApi): ActividadOT {
  const tipo: TipoActividad =
    d.origenCodigo === 'SERVICIO' || d.origenCodigo === 'REPUESTO' ? d.origenCodigo : 'OTRO';
  return { tipo, codigo: d.codigoActividad, descripcion: d.actividad, cantidad: d.cantidad };
}
