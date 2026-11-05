import { DomainError } from '../errors/DomainError.js';

/**
 * INFORME TÉCNICO: el documento final que se entrega al cliente.
 * Sigue la plantilla de Pineda Automotriz (pág. 1 datos + diagnóstico,
 * págs. siguientes fotos numeradas con leyenda).
 *
 * La IA propone un borrador; el jefe lo revisa y edita antes de descargarlo.
 */
export interface ItemCantidad {
  descripcion: string;
  cantidad: string; // texto: "2", "0.5H", "1 GL"
}

export interface FotoInforme {
  fotoId: string;
  leyenda: string; // ej. "Reemplazo de filtro de A/C."
}

export interface ContenidoInforme {
  // Encabezado
  motivo: string; // "MANTENIMIENTO PREVENTIVO 135000 KM"
  sede: string; // "TRUJILLO"
  fecha: string; // AAAA-MM-DD
  responsable: string;
  nroOrden: string;
  tituloFotoPrincipal: string; // "MANTENIMIENTO PREVENTIVO"

  // Datos del vehículo
  marca: string;
  modelo: string;
  placa: string;
  vin: string;
  kilometraje: string;
  anioModelo: string;
  fechaIngreso: string; // DD-MM-AAAA
  cliente: string;
  vozCliente: string;

  // Cuerpo (lo redacta la IA a partir del técnico)
  condicion: string;
  historial: string;
  diagnosticoIntro: string;
  observaciones: string[];
  conclusion: string;
  recomendaciones: string[];

  // Tablas (vienen de la OT)
  repuestos: ItemCantidad[];
  manoObra: ItemCantidad[];

  // Foto grande de la pág. 1 (normalmente el frente del vehículo)
  fotoPrincipalId: string | null;
  // Anexo fotográfico: orden y leyenda de cada foto (págs. 2 en adelante)
  fotos: FotoInforme[];

  // Firmas
  jefeNombre: string;
  jefeCargo: string;
  tecnicoNombre: string;
}

export interface InformeTecnico {
  reporteId: string;
  contenido: ContenidoInforme;
  generadoPor: string; // "gemini-flash-latest" o "sin-ia"
  creadoEn: Date;
  actualizadoEn: Date;
}

/** Revisa que el contenido editado por el jefe sea coherente con el reporte. */
export function validarContenido(c: ContenidoInforme, fotosDelReporte: string[]) {
  if (!c.motivo.trim()) throw new DomainError('El motivo del informe es obligatorio');
  if (!c.placa.trim()) throw new DomainError('La placa es obligatoria');
  const validas = new Set(fotosDelReporte);
  const ajena = c.fotos.find((f) => !validas.has(f.fotoId));
  if (ajena) throw new DomainError('El informe incluye una foto que no pertenece al reporte');
  if (c.fotoPrincipalId && !validas.has(c.fotoPrincipalId)) {
    throw new DomainError('La foto principal no pertenece al reporte');
  }
}
