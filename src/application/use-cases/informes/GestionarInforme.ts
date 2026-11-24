import type { UsuarioSesion } from '../../../domain/entities/Usuario.js';
import { esJefe } from '../../../domain/entities/Usuario.js';
import type { Reporte } from '../../../domain/entities/Reporte.js';
import { validarContenido, type ContenidoInforme, type InformeTecnico } from '../../../domain/entities/InformeTecnico.js';
import { AccesoDenegadoError } from '../../../domain/errors/AuthErrors.js';
import { DomainError } from '../../../domain/errors/DomainError.js';
import { RecursoNoEncontradoError } from '../../../domain/errors/RecursoNoEncontradoError.js';
import type { ReporteRepository } from '../../ports/ReporteRepository.js';
import type { InformeRepository } from '../../ports/InformeRepository.js';
import type { OrdenTrabajoProvider } from '../../ports/OrdenTrabajoProvider.js';
import type { AlmacenamientoArchivos } from '../../ports/AlmacenamientoArchivos.js';
import type { RedactorInforme } from '../../ports/RedactorInforme.js';
import type { GeneradorDocumento } from '../../ports/GeneradorDocumento.js';
import { cargarReporte } from '../reportes/cargarReporte.js';

/** Datos fijos del taller que van en todos los informes (vienen de .env). */
export interface DatosTaller {
  jefeNombre: string; // "NIXON A. QUISPE ACOSTA"
  jefeCargo: string; // "Jefe de taller - Trujillo"
  responsable: string; // "Nixon Quispe"
  sede: string; // "TRUJILLO": sede a la que pertenecen la firma y el responsable de arriba
  nombresSede: Record<string, string>; // { CALLAO: 'LIMA' }: cómo se muestra cada sede en el informe
}

/**
 * CASOS DE USO del informe técnico (solo jefe de taller):
 *   generar   -> la IA redacta un borrador a partir del reporte del técnico
 *   guardar   -> el jefe corrige el borrador
 *   descargar -> se arma el Word con todas las fotos
 */
export class GestionarInforme {
  constructor(
    private readonly reportes: ReporteRepository,
    private readonly informes: InformeRepository,
    private readonly ordenes: OrdenTrabajoProvider,
    private readonly archivos: AlmacenamientoArchivos,
    private readonly redactor: RedactorInforme,
    private readonly documento: GeneradorDocumento,
    private readonly taller: DatosTaller,
  ) {}

  async obtener(jefe: UsuarioSesion, reporteId: string) {
    await this.reporteParaInforme(jefe, reporteId);
    const informe = await this.informes.obtener(reporteId);
    if (!informe) throw new RecursoNoEncontradoError('Este reporte aún no tiene informe');
    return informe;
  }

  async generar(jefe: UsuarioSesion, reporteId: string): Promise<InformeTecnico> {
    const reporte = await this.reporteParaInforme(jefe, reporteId);
    const r = reporte.datos();
    const ot = await this.ordenes.obtenerPorId(r.ot.otId);
    const fotos = [...r.fotos].sort((a, b) => a.orden - b.orden);

    // Fotos en tamaño normal para que la IA también "vea" lo que describe el técnico
    const imagenes = await Promise.all(fotos.map((f) => this.leerArchivo(f.clave)));

    const redaccion = await this.redactor.redactar({
      vehiculo: `${r.ot.vehiculo} ${r.ot.anio ?? ''}`.trim(),
      kilometraje: r.ot.kilometraje,
      servicio: r.ot.servicio,
      tipoOt: ot?.tipoOt ?? null,
      requerimientoTecnico: r.requerimiento,
      actividadesOT: (ot?.actividades ?? []).map((a) => `${a.tipo}: ${a.descripcion} x${a.cantidad}`),
      fotos: fotos.map((f, i) => ({ numero: i + 1, descripcionTecnico: f.descripcion, imagen: imagenes[i], tipo: 'image/jpeg' })),
    });

    const leyenda = (n: number) => redaccion.leyendas.find((l) => l.numero === n)?.leyenda;
    const v = ot?.vehiculo;
    const hoy = new Date();

    // "Pineda Callao" -> "CALLAO" -> se muestra "LIMA". La firma de .env es de SU sede
    // (Trujillo); en las demás firma el jefe técnico que genera el informe.
    const sedeOT = (r.ot.localNombre ?? ot?.local ?? '').replace(/^pineda\s*/i, '').trim().toUpperCase() || this.taller.sede;
    const sede = this.taller.nombresSede[sedeOT] ?? sedeOT;
    const firmaEnv = sedeOT === this.taller.sede;
    const firma = {
      responsable: (firmaEnv && this.taller.responsable) || jefe.nombre,
      jefeNombre: (firmaEnv && this.taller.jefeNombre) || jefe.nombre,
      jefeCargo: firmaEnv ? this.taller.jefeCargo : `Jefe de taller - ${sede.charAt(0)}${sede.slice(1).toLowerCase()}`,
    };

    const contenido: ContenidoInforme = {
      motivo: redaccion.motivo,
      sede,
      fecha: hoy.toISOString().slice(0, 10),
      responsable: firma.responsable,
      nroOrden: r.ot.nroOrden,
      tituloFotoPrincipal: redaccion.tituloFotoPrincipal,

      marca: v?.marca ?? r.ot.vehiculo.split(' ')[0] ?? '',
      modelo: v ? [v.modelo, v.version?.replace(/^\d+\s*/, '')].filter(Boolean).join(' ') : r.ot.vehiculo,
      placa: r.ot.placa,
      vin: r.ot.vin ?? '',
      kilometraje: r.ot.kilometraje?.toLocaleString('en-US') ?? '',
      anioModelo: r.ot.anio ? String(r.ot.anio) : '',
      fechaIngreso: ot?.fechaApertura ? ot.fechaApertura.split('-').reverse().join('-') : '',
      cliente: r.ot.clienteNombre,
      vozCliente: r.ot.servicio ?? '',

      condicion: redaccion.condicion,
      historial: '',
      diagnosticoIntro: redaccion.diagnosticoIntro,
      observaciones: redaccion.observaciones,
      conclusion: redaccion.conclusion,
      recomendaciones: redaccion.recomendaciones,

      repuestos: (ot?.actividades ?? [])
        .filter((a) => a.tipo === 'REPUESTO')
        .map((a) => ({ descripcion: a.descripcion, cantidad: String(a.cantidad) })),
      manoObra: (ot?.actividades ?? [])
        .filter((a) => a.tipo === 'SERVICIO' && !/^materiales$/i.test(a.descripcion.trim()))
        .map((a) => ({ descripcion: a.descripcion, cantidad: '' })),

      // La 1ª foto va grande en la pág. 1 y no se repite en el anexo (como la plantilla).
      // El jefe puede cambiar la principal o volver a incluirla desde el editor.
      fotoPrincipalId: fotos[0]?.id ?? null,
      fotos: fotos
        .map((f, i) => ({ fotoId: f.id, leyenda: leyenda(i + 1) || f.descripcion || `Foto ${i + 1}` }))
        .slice(fotos.length > 1 ? 1 : 0),

      jefeNombre: firma.jefeNombre,
      jefeCargo: firma.jefeCargo,
      // Técnico de la OT (Trujillo y Lima igual). Si no hay, el que hizo el reporte;
      // nunca el jefe (los reportes que creó el jefe tienen tecnicoId 0).
      tecnicoNombre: ot?.tecnicoNombre || (r.tecnicoId ? r.tecnicoNombre : ''),
    };

    const previo = await this.informes.obtener(reporteId);
    const informe: InformeTecnico = {
      reporteId,
      contenido,
      generadoPor: redaccion.modelo,
      creadoEn: previo?.creadoEn ?? hoy,
      actualizadoEn: hoy,
    };
    await this.informes.guardar(informe);
    return informe;
  }

  async guardar(jefe: UsuarioSesion, reporteId: string, contenido: ContenidoInforme) {
    const reporte = await this.reporteParaInforme(jefe, reporteId);
    const previo = await this.informes.obtener(reporteId);
    if (!previo) throw new DomainError('Primero genera el informe');

    validarContenido(contenido, reporte.fotos.map((f) => f.id));
    const informe = { ...previo, contenido, actualizadoEn: new Date() };
    await this.informes.guardar(informe);
    return informe;
  }

  async descargar(jefe: UsuarioSesion, reporteId: string) {
    const informe = await this.obtener(jefe, reporteId);
    const reporte = await this.reporteParaInforme(jefe, reporteId);
    const fotos = new Map(reporte.fotos.map((f) => [f.id, f]));

    const ids = new Set(informe.contenido.fotos.map((f) => f.fotoId));
    if (informe.contenido.fotoPrincipalId) ids.add(informe.contenido.fotoPrincipalId);
    const imagenes = await Promise.all(
      [...ids]
        .filter((id) => fotos.has(id))
        .map(async (id) => ({ fotoId: id, datos: await this.leerArchivo(fotos.get(id)!.clave) })),
    );
    const datos = await this.documento.generar(informe.contenido, imagenes);
    const c = informe.contenido;
    const nombre = `INFORME TECNICO ${c.motivo} ${c.placa}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return { nombre: `${nombre}.${this.documento.extension}`, tipo: this.documento.tipoMime, datos };
  }

  // ---------- internos ----------

  private async reporteParaInforme(u: UsuarioSesion, id: string): Promise<Reporte> {
    if (!esJefe(u)) throw new AccesoDenegadoError('Solo el jefe de taller puede generar informes');
    const r = await cargarReporte(this.reportes, u, id);
    if (r.estado !== 'ENVIADO' && r.estado !== 'APROBADO') {
      throw new DomainError('Solo se generan informes de reportes enviados o aprobados');
    }
    if (r.fotos.length === 0) throw new DomainError('El reporte no tiene fotos');
    return r;
  }

  private async leerArchivo(clave: string): Promise<Buffer> {
    const a = await this.archivos.leer(clave);
    if (!a) throw new RecursoNoEncontradoError(`No se encontró la foto ${clave}`);
    const partes: Buffer[] = [];
    for await (const p of a.contenido) partes.push(p as Buffer);
    return Buffer.concat(partes);
  }
}
