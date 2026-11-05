import type { Reporte } from '../../../domain/entities/Reporte.js';
import type { UsuarioSesion } from '../../../domain/entities/Usuario.js';
import { RecursoNoEncontradoError } from '../../../domain/errors/RecursoNoEncontradoError.js';
import type { ReporteRepository } from '../../ports/ReporteRepository.js';

/**
 * Busca un reporte y verifica que el usuario pueda verlo.
 * Si no puede, responde "no existe" (no revelamos que hay algo ahí).
 */
export async function cargarReporte(repo: ReporteRepository, usuario: UsuarioSesion, id: string): Promise<Reporte> {
  const r = await repo.obtener(id);
  if (!r || !r.puedeVer(usuario)) throw new RecursoNoEncontradoError('Reporte no encontrado');
  return r;
}
