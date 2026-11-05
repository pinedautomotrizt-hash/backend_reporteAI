import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/DomainError.js';
import { AccesoDenegadoError } from '../errors/AuthErrors.js';
import { esJefe, type UsuarioSesion } from './Usuario.js';

/**
 * REPORTE TÉCNICO: lo que el técnico arma con fotos sobre el vehículo de una OT
 * y envía al jefe de taller. Es la materia prima del informe con IA.
 *
 * Ciclo de vida:
 *   BORRADOR ──enviar──▶ ENVIADO ──aprobar──▶ APROBADO
 *       ▲                   │
 *       └──── OBSERVADO ◀───┘ (el jefe lo devuelve con un comentario)
 *
 * Todas las reglas viven aquí; la base de datos y HTTP no deciden nada.
 */
export type EstadoReporte = 'BORRADOR' | 'ENVIADO' | 'OBSERVADO' | 'APROBADO';

export const MAX_FOTOS = 20;

/** Datos de la OT copiados al crear el reporte (quedan fijos como historial). */
export interface DatosOT {
  otId: number;
  nroOrden: string;
  placa: string;
  vehiculo: string; // "MITSUBISHI L200 8502 MODERNO"
  vin: string | null;
  anio: number | null;
  kilometraje: number | null;
  servicio: string | null;
  clienteNombre: string;
}

export interface Foto {
  id: string;
  clave: string; // ubicación del archivo en el almacenamiento
  claveMiniatura: string;
  descripcion: string;
  orden: number;
  bytes: number;
  creadaEn: Date;
}

export interface CambioEstado {
  id: string;
  estadoAnterior: EstadoReporte | null;
  estadoNuevo: EstadoReporte;
  usuarioId: number;
  usuarioNombre: string;
  comentario: string | null;
  fecha: Date;
}

export interface ReporteProps {
  id: string;
  ot: DatosOT;
  tecnicoId: number;
  tecnicoNombre: string;
  usuarioId: number;
  requerimiento: string;
  estado: EstadoReporte;
  fotos: Foto[];
  historial: CambioEstado[];
  creadoEn: Date;
  actualizadoEn: Date;
  enviadoEn: Date | null;
}

export class Reporte {
  private constructor(private props: ReporteProps) {}

  // ---------- creación ----------

  static crear(ot: DatosOT, autor: UsuarioSesion, tecnico: { id: number; nombre: string }): Reporte {
    const ahora = new Date();
    const r = new Reporte({
      id: randomUUID(),
      ot,
      tecnicoId: tecnico.id,
      tecnicoNombre: tecnico.nombre,
      usuarioId: autor.id,
      requerimiento: '',
      estado: 'BORRADOR',
      fotos: [],
      historial: [],
      creadoEn: ahora,
      actualizadoEn: ahora,
      enviadoEn: null,
    });
    r.registrarCambio(null, 'BORRADOR', autor, null);
    return r;
  }

  /** Reconstruye un reporte leído de la base de datos (sin validar de nuevo). */
  static desdePersistencia(props: ReporteProps): Reporte {
    return new Reporte(props);
  }

  // ---------- lectura ----------

  get id() { return this.props.id; }
  get estado() { return this.props.estado; }
  get fotos(): readonly Foto[] { return this.props.fotos; }
  get usuarioId() { return this.props.usuarioId; }
  get tecnicoId() { return this.props.tecnicoId; }
  get ot() { return this.props.ot; }
  get editable() { return this.props.estado === 'BORRADOR' || this.props.estado === 'OBSERVADO'; }

  /** Copia de solo lectura de todos los datos (para guardar o responder). */
  datos(): Readonly<ReporteProps> {
    return { ...this.props, fotos: [...this.props.fotos], historial: [...this.props.historial] };
  }

  // ---------- permisos ----------

  esAutor(u: UsuarioSesion) {
    return u.id === this.props.usuarioId;
  }

  /** El autor siempre lo ve; el jefe lo ve solo cuando ya fue enviado (los borradores son privados). */
  puedeVer(u: UsuarioSesion) {
    if (this.esAutor(u)) return true;
    return esJefe(u) && this.props.estado !== 'BORRADOR';
  }

  // ---------- acciones del técnico ----------

  actualizarRequerimiento(u: UsuarioSesion, texto: string) {
    this.verificarEdicion(u);
    this.props.requerimiento = texto.trim().slice(0, 5000);
    this.tocar();
  }

  agregarFoto(u: UsuarioSesion, foto: Omit<Foto, 'orden' | 'creadaEn'>) {
    this.verificarEdicion(u);
    if (this.props.fotos.length >= MAX_FOTOS) {
      throw new DomainError(`Máximo ${MAX_FOTOS} fotos por reporte`);
    }
    const orden = Math.max(0, ...this.props.fotos.map((f) => f.orden)) + 1;
    this.props.fotos.push({ ...foto, descripcion: foto.descripcion.trim().slice(0, 1000), orden, creadaEn: new Date() });
    this.tocar();
  }

  describirFoto(u: UsuarioSesion, fotoId: string, descripcion: string) {
    this.verificarEdicion(u);
    this.buscarFoto(fotoId).descripcion = descripcion.trim().slice(0, 1000);
    this.tocar();
  }

  /** Devuelve la foto quitada para que el caso de uso borre el archivo. */
  quitarFoto(u: UsuarioSesion, fotoId: string): Foto {
    this.verificarEdicion(u);
    const foto = this.buscarFoto(fotoId);
    this.props.fotos = this.props.fotos.filter((f) => f.id !== fotoId);
    this.tocar();
    return foto;
  }

  enviar(u: UsuarioSesion) {
    this.verificarEdicion(u);
    if (this.props.fotos.length === 0) throw new DomainError('Agrega al menos una foto antes de enviar');
    if (!this.props.requerimiento) throw new DomainError('Describe el requerimiento antes de enviar');
    this.props.enviadoEn = new Date();
    this.cambiarEstado('ENVIADO', u, null);
  }

  // ---------- acciones del jefe ----------

  aprobar(jefe: UsuarioSesion, comentario?: string) {
    this.exigirRevision(jefe);
    this.cambiarEstado('APROBADO', jefe, comentario?.trim() || null);
  }

  observar(jefe: UsuarioSesion, comentario: string) {
    this.exigirRevision(jefe);
    if (!comentario?.trim()) throw new DomainError('Escribe qué debe corregir el técnico');
    this.cambiarEstado('OBSERVADO', jefe, comentario.trim());
  }

  // ---------- internos ----------

  /** Lanza error si el usuario no puede modificar el reporte ahora. */
  verificarEdicion(u: UsuarioSesion) {
    if (!this.esAutor(u)) throw new AccesoDenegadoError('Solo el autor puede modificar este reporte');
    if (!this.editable) throw new DomainError(`El reporte está ${this.props.estado} y ya no se puede modificar`);
  }

  private exigirRevision(u: UsuarioSesion) {
    if (!esJefe(u)) throw new AccesoDenegadoError('Solo el jefe de taller puede revisar reportes');
    if (this.props.estado !== 'ENVIADO') {
      throw new DomainError(`Solo se revisan reportes ENVIADOS (este está ${this.props.estado})`);
    }
  }

  private buscarFoto(id: string): Foto {
    const f = this.props.fotos.find((x) => x.id === id);
    if (!f) throw new DomainError('La foto no existe en este reporte');
    return f;
  }

  private cambiarEstado(nuevo: EstadoReporte, u: UsuarioSesion, comentario: string | null) {
    const anterior = this.props.estado;
    this.props.estado = nuevo;
    this.registrarCambio(anterior, nuevo, u, comentario);
    this.tocar();
  }

  private registrarCambio(anterior: EstadoReporte | null, nuevo: EstadoReporte, u: UsuarioSesion, comentario: string | null) {
    this.props.historial.push({
      id: randomUUID(),
      estadoAnterior: anterior,
      estadoNuevo: nuevo,
      usuarioId: u.id,
      usuarioNombre: u.nombre,
      comentario,
      fecha: new Date(),
    });
  }

  private tocar() {
    this.props.actualizadoEn = new Date();
  }
}
