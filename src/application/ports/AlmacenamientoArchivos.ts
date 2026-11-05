import type { Readable } from 'node:stream';

/**
 * PUERTO DE SALIDA: dónde viven las fotos.
 *
 * Hoy: disco local (en Railway, un "Volume").
 * Mañana: Cloudflare R2 / S3 / Google Drive -> solo se escribe otro adaptador.
 */
export interface ArchivoLeido {
  contenido: Readable;
  tipo: string; // MIME, ej. image/jpeg
  bytes: number;
}

export interface AlmacenamientoArchivos {
  guardar(clave: string, datos: Buffer, tipo: string): Promise<void>;
  leer(clave: string): Promise<ArchivoLeido | null>;
  eliminar(clave: string): Promise<void>;
  /** URL que funciona por un tiempo limitado, para usar en <img src="...">. */
  urlTemporal(clave: string, segundos?: number): string;
}
