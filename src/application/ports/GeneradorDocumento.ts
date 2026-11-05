import type { ContenidoInforme } from '../../domain/entities/InformeTecnico.js';

/** PUERTO DE SALIDA: convertir el informe en un archivo (hoy Word .docx). */
export interface ImagenParaDocumento {
  fotoId: string;
  datos: Buffer;
}

export interface GeneradorDocumento {
  readonly extension: string; // "docx"
  readonly tipoMime: string;
  generar(contenido: ContenidoInforme, imagenes: ImagenParaDocumento[]): Promise<Buffer>;
}
