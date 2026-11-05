import type { RowDataPacket } from 'mysql2/promise';
import { Reporte, type CambioEstado, type EstadoReporte, type Foto } from '../../../domain/entities/Reporte.js';
import type { FiltroReportes, ReporteRepository, ResumenReporte } from '../../../application/ports/ReporteRepository.js';
import type { Pool } from './conexion.js';

/**
 * ADAPTADOR: implementa ReporteRepository con MySQL.
 *
 * Guarda el reporte "completo" (datos + fotos + historial) dentro de una
 * TRANSACCIÓN: o se guarda todo, o nada. Así nunca queda a medias.
 */
export class MySqlReporteRepository implements ReporteRepository {
  constructor(private readonly pool: Pool) {}

  async guardar(reporte: Reporte): Promise<void> {
    const d = reporte.datos();
    const cx = await this.pool.getConnection();
    try {
      await cx.beginTransaction();

      await cx.query(
        `INSERT INTO reportes (id, estado, ot_id, nro_orden, placa, vehiculo, vin, anio, kilometraje, servicio,
           cliente_nombre, tecnico_id, tecnico_nombre, usuario_id, requerimiento, creado_en, actualizado_en, enviado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE estado = VALUES(estado), requerimiento = VALUES(requerimiento),
           actualizado_en = VALUES(actualizado_en), enviado_en = VALUES(enviado_en)`,
        [
          d.id, d.estado, d.ot.otId, d.ot.nroOrden, d.ot.placa, d.ot.vehiculo, d.ot.vin, d.ot.anio,
          d.ot.kilometraje, d.ot.servicio, d.ot.clienteNombre, d.tecnicoId, d.tecnicoNombre, d.usuarioId,
          d.requerimiento, d.creadoEn, d.actualizadoEn, d.enviadoEn,
        ],
      );

      // Fotos: borrar las que ya no están y crear/actualizar las actuales
      const ids = d.fotos.map((f) => f.id);
      if (ids.length) {
        await cx.query('DELETE FROM reporte_fotos WHERE reporte_id = ? AND id NOT IN (?)', [d.id, ids]);
        await cx.query(
          `INSERT INTO reporte_fotos (id, reporte_id, clave, clave_miniatura, descripcion, orden, bytes, creada_en)
           VALUES ? ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), orden = VALUES(orden)`,
          [d.fotos.map((f) => [f.id, d.id, f.clave, f.claveMiniatura, f.descripcion, f.orden, f.bytes, f.creadaEn])],
        );
      } else {
        await cx.query('DELETE FROM reporte_fotos WHERE reporte_id = ?', [d.id]);
      }

      // Historial: solo se agrega, nunca se modifica
      if (d.historial.length) {
        await cx.query(
          `INSERT IGNORE INTO reporte_historial
             (id, reporte_id, estado_anterior, estado_nuevo, usuario_id, usuario_nombre, comentario, fecha) VALUES ?`,
          [d.historial.map((h) => [h.id, d.id, h.estadoAnterior, h.estadoNuevo, h.usuarioId, h.usuarioNombre, h.comentario, h.fecha])],
        );
      }

      await cx.commit();
    } catch (e) {
      await cx.rollback();
      throw e;
    } finally {
      cx.release();
    }
  }

  async obtener(id: string): Promise<Reporte | null> {
    const [filas] = await this.pool.query<RowDataPacket[]>('SELECT * FROM reportes WHERE id = ?', [id]);
    const fila = filas[0];
    if (!fila) return null;

    const [[fotos], [historial]] = await Promise.all([
      this.pool.query<RowDataPacket[]>('SELECT * FROM reporte_fotos WHERE reporte_id = ? ORDER BY orden', [id]),
      this.pool.query<RowDataPacket[]>('SELECT * FROM reporte_historial WHERE reporte_id = ? ORDER BY fecha', [id]),
    ]);

    return Reporte.desdePersistencia({
      id: fila.id,
      estado: fila.estado,
      ot: {
        otId: fila.ot_id,
        nroOrden: fila.nro_orden,
        placa: fila.placa,
        vehiculo: fila.vehiculo,
        vin: fila.vin,
        anio: fila.anio,
        kilometraje: fila.kilometraje,
        servicio: fila.servicio,
        clienteNombre: fila.cliente_nombre,
      },
      tecnicoId: fila.tecnico_id,
      tecnicoNombre: fila.tecnico_nombre,
      usuarioId: fila.usuario_id,
      requerimiento: fila.requerimiento,
      creadoEn: fila.creado_en,
      actualizadoEn: fila.actualizado_en,
      enviadoEn: fila.enviado_en,
      fotos: fotos.map(
        (f): Foto => ({
          id: f.id,
          clave: f.clave,
          claveMiniatura: f.clave_miniatura,
          descripcion: f.descripcion,
          orden: f.orden,
          bytes: f.bytes,
          creadaEn: f.creada_en,
        }),
      ),
      historial: historial.map(
        (h): CambioEstado => ({
          id: h.id,
          estadoAnterior: h.estado_anterior,
          estadoNuevo: h.estado_nuevo,
          usuarioId: h.usuario_id,
          usuarioNombre: h.usuario_nombre,
          comentario: h.comentario,
          fecha: h.fecha,
        }),
      ),
    });
  }

  async buscarAbierto(usuarioId: number, otId: number): Promise<Reporte | null> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      `SELECT id FROM reportes WHERE usuario_id = ? AND ot_id = ? AND estado IN ('BORRADOR','OBSERVADO')
       ORDER BY actualizado_en DESC LIMIT 1`,
      [usuarioId, otId],
    );
    return filas[0] ? this.obtener(filas[0].id) : null;
  }

  async listar(f: FiltroReportes): Promise<{ items: ResumenReporte[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (f.usuarioId !== undefined) { where.push('r.usuario_id = ?'); params.push(f.usuarioId); }
    if (f.excluirBorradores) where.push(`r.estado <> 'BORRADOR'`);
    if (f.estados?.length) { where.push('r.estado IN (?)'); params.push(f.estados); }
    if (f.placa) { where.push('r.placa LIKE ?'); params.push(`%${f.placa}%`); }
    if (f.tecnicoId !== undefined) { where.push('r.tecnico_id = ?'); params.push(f.tecnicoId); }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[filas], [conteo]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        `SELECT r.*,
           (SELECT COUNT(*) FROM reporte_fotos f WHERE f.reporte_id = r.id) AS total_fotos,
           (SELECT f.clave_miniatura FROM reporte_fotos f WHERE f.reporte_id = r.id ORDER BY f.orden LIMIT 1) AS portada
         FROM reportes r ${sqlWhere}
         ORDER BY COALESCE(r.enviado_en, r.actualizado_en) DESC
         LIMIT ? OFFSET ?`,
        [...params, f.limite, f.desde],
      ),
      this.pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM reportes r ${sqlWhere}`, params),
    ]);

    return {
      total: Number(conteo[0]?.total ?? 0),
      items: filas.map((r) => ({
        id: r.id,
        estado: r.estado as EstadoReporte,
        otId: r.ot_id,
        nroOrden: r.nro_orden,
        placa: r.placa,
        vehiculo: r.vehiculo,
        servicio: r.servicio,
        clienteNombre: r.cliente_nombre,
        tecnicoId: r.tecnico_id,
        tecnicoNombre: r.tecnico_nombre,
        requerimiento: r.requerimiento,
        totalFotos: Number(r.total_fotos),
        claveMiniaturaPortada: r.portada ?? null,
        creadoEn: r.creado_en,
        actualizadoEn: r.actualizado_en,
        enviadoEn: r.enviado_en,
      })),
    };
  }
}
