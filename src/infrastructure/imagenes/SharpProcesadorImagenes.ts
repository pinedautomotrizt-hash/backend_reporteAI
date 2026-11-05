import sharp from 'sharp';
import type { ImagenProcesada, ProcesadorImagenes } from '../../application/ports/ProcesadorImagenes.js';
import { DomainError } from '../../domain/errors/DomainError.js';

const LADO_MAX = 2048; // suficiente para ver detalles e incluir en el informe
const LADO_MINIATURA = 400;

/**
 * ADAPTADOR: procesa fotos con la librería "sharp".
 *  - .rotate() corrige la orientación (fotos de celular que salen "acostadas").
 *  - Reduce a máx. 2048 px y comprime a JPEG: una foto de 5 MB queda en ~400 KB.
 *  - Quita metadatos EXIF (incluida la ubicación GPS del celular).
 */
export class SharpProcesadorImagenes implements ProcesadorImagenes {
  async procesar(original: Buffer): Promise<ImagenProcesada> {
    try {
      const meta = await sharp(original).metadata();
      if (!meta.format || !['jpeg', 'png', 'webp', 'heif', 'avif', 'tiff'].includes(meta.format)) {
        throw new DomainError('El archivo no es una imagen válida (usa JPG, PNG o WEBP)');
      }

      const base = sharp(original, { failOn: 'error' }).rotate();
      const [principal, miniatura] = await Promise.all([
        base.clone()
          .resize(LADO_MAX, LADO_MAX, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer(),
        base.clone()
          .resize(LADO_MINIATURA, LADO_MINIATURA, { fit: 'cover' })
          .jpeg({ quality: 70 })
          .toBuffer(),
      ]);

      return {
        principal: { datos: principal, tipo: 'image/jpeg', extension: 'jpg' },
        miniatura: { datos: miniatura, tipo: 'image/jpeg', extension: 'jpg' },
      };
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError('No se pudo leer la imagen. Intenta con otra foto.');
    }
  }
}
