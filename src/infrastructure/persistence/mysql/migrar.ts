import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from './conexion.js';

/**
 * Migraciones: archivos .sql numerados en /migrations que se aplican en orden,
 * una sola vez cada uno. La tabla `_migraciones` recuerda cuáles ya se aplicaron.
 *
 * Para cambiar la base de datos en el futuro: crear 002_algo.sql (nunca editar
 * uno ya aplicado). Se ejecutan solas al arrancar el servidor.
 */
export async function migrar(pool: Pool, carpeta = join(process.cwd(), 'migrations'), log = console.log) {
  await pool.query(`CREATE TABLE IF NOT EXISTS _migraciones (
    nombre VARCHAR(200) NOT NULL PRIMARY KEY,
    aplicada_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  )`);

  const [filas] = await pool.query('SELECT nombre FROM _migraciones');
  const aplicadas = new Set((filas as { nombre: string }[]).map((f) => f.nombre));
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await readFile(join(carpeta, archivo), 'utf8');
    const sentencias = sql
      .split(/;\s*$/m)
      .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean);

    const cx = await pool.getConnection();
    try {
      for (const s of sentencias) await cx.query(s);
      await cx.query('INSERT INTO _migraciones (nombre) VALUES (?)', [archivo]);
      log(`Migración aplicada: ${archivo}`);
    } finally {
      cx.release();
    }
  }
}
