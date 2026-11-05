import type { RowDataPacket } from 'mysql2/promise';
import type { InformeRepository } from '../../../application/ports/InformeRepository.js';
import type { ContenidoInforme, InformeTecnico } from '../../../domain/entities/InformeTecnico.js';
import type { Pool } from './conexion.js';

/** ADAPTADOR: guarda el informe en MySQL (el contenido como columna JSON). */
export class MySqlInformeRepository implements InformeRepository {
  constructor(private readonly pool: Pool) {}

  async obtener(reporteId: string): Promise<InformeTecnico | null> {
    const [filas] = await this.pool.query<RowDataPacket[]>('SELECT * FROM informes WHERE reporte_id = ?', [reporteId]);
    const f = filas[0];
    if (!f) return null;
    return {
      reporteId: f.reporte_id,
      // mysql2 ya convierte las columnas JSON en objeto; por si acaso, se acepta texto
      contenido: (typeof f.contenido === 'string' ? JSON.parse(f.contenido) : f.contenido) as ContenidoInforme,
      generadoPor: f.generado_por,
      creadoEn: f.creado_en,
      actualizadoEn: f.actualizado_en,
    };
  }

  async guardar(i: InformeTecnico): Promise<void> {
    await this.pool.query(
      `INSERT INTO informes (reporte_id, contenido, generado_por, creado_en, actualizado_en) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE contenido = VALUES(contenido), generado_por = VALUES(generado_por),
         actualizado_en = VALUES(actualizado_en)`,
      [i.reporteId, JSON.stringify(i.contenido), i.generadoPor, i.creadoEn, i.actualizadoEn],
    );
  }
}
