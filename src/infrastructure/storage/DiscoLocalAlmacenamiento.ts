import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { AlmacenamientoArchivos, ArchivoLeido } from '../../application/ports/AlmacenamientoArchivos.js';

const TIPOS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
const CLAVE_VALIDA = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/**
 * ADAPTADOR: guarda las fotos en una carpeta del disco.
 *  - Desarrollo: ./uploads
 *  - Railway: un Volume montado (ej. /data/uploads) para que no se borren al redesplegar.
 *
 * Las fotos NO son públicas. Se sirven con URLs firmadas que expiran
 * (mismo concepto que las "presigned URLs" de S3/R2):
 *   /api/archivos/<clave>?exp=1730000000&firma=abc...
 */
export class DiscoLocalAlmacenamiento implements AlmacenamientoArchivos {
  private readonly raiz: string;

  constructor(carpeta: string, private readonly secreto: string) {
    this.raiz = resolve(carpeta);
  }

  async guardar(clave: string, datos: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, datos);
  }

  async leer(clave: string): Promise<ArchivoLeido | null> {
    const ruta = this.ruta(clave);
    try {
      const info = await stat(ruta);
      const ext = clave.split('.').pop()?.toLowerCase() ?? '';
      return { contenido: createReadStream(ruta), tipo: TIPOS[ext] ?? 'application/octet-stream', bytes: info.size };
    } catch {
      return null;
    }
  }

  async eliminar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }

  urlTemporal(clave: string, segundos = 2 * 60 * 60): string {
    const exp = Math.floor(Date.now() / 1000) + segundos;
    return `/api/archivos/${clave}?exp=${exp}&firma=${this.firmar(clave, exp)}`;
  }

  /** Usado por la ruta HTTP que entrega los archivos. */
  firmaValida(clave: string, exp: number, firma: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const esperada = Buffer.from(this.firmar(clave, exp));
    const recibida = Buffer.from(firma);
    return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
  }

  private firmar(clave: string, exp: number) {
    return createHmac('sha256', this.secreto).update(`${clave}:${exp}`).digest('base64url');
  }

  /** Convierte la clave en ruta del disco, impidiendo salir de la carpeta (../../). */
  private ruta(clave: string): string {
    if (!CLAVE_VALIDA.test(clave) || clave.includes('..')) throw new Error(`Clave de archivo inválida: ${clave}`);
    const ruta = resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + sep)) throw new Error('Ruta fuera del almacenamiento');
    return ruta;
  }
}
