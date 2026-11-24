import type { IdentidadExterna, ProveedorIdentidad } from '../ports/ProveedorIdentidad.js';
import type { EmisorTokens } from '../ports/EmisorTokens.js';
import type { UsuarioSesion } from '../../domain/entities/Usuario.js';
import { AccesoDenegadoError, CredencialesInvalidasError } from '../../domain/errors/AuthErrors.js';

/**
 * CASO DE USO: iniciar sesión con el usuario de Control de Personal.
 *
 * Reglas de negocio para decidir el rol en ESTA app:
 *   1. Si su rol en Control de Personal está en `rolesJefe`  -> JEFE_TALLER
 *   2. Si tiene ficha de técnico activa                     -> TECNICO
 *   3. Cualquier otro caso                                  -> sin acceso
 */
export class IniciarSesion {
  constructor(
    private readonly identidad: ProveedorIdentidad,
    private readonly tokens: EmisorTokens,
    private readonly rolesJefe: string[],
  ) {}

  async ejecutar(email: string, password: string): Promise<{ token: string; usuario: UsuarioSesion }> {
    const persona = await this.identidad.autenticar(email.trim().toLowerCase(), password);
    if (!persona) throw new CredencialesInvalidasError();

    const usuario = await this.resolverRol(persona);
    const token = await this.tokens.emitir(usuario);
    return { token, usuario };
  }

  private async resolverRol(p: IdentidadExterna): Promise<UsuarioSesion> {
    const { usuarioId: id, nombre, email } = p;
    if (this.rolesJefe.includes(p.rolSistema.toLowerCase())) {
      // admin -> sin local (todas las sedes); jefe_tecnico -> solo su sede
      if (p.rolSistema.toLowerCase() !== 'admin' && p.localId === null) {
        throw new AccesoDenegadoError('Tu usuario no tiene una sede asignada en Control de Personal.');
      }
      const localId = p.rolSistema.toLowerCase() === 'admin' ? null : p.localId;
      return { id, nombre, email, rol: 'JEFE_TALLER', tecnicoId: null, localId, localNombre: localId ? p.localNombre : null };
    }

    const ficha = await this.identidad.buscarTecnicoPorUsuario(id);
    if (ficha?.activo) {
      return {
        id, nombre: ficha.nombre, email, rol: 'TECNICO', tecnicoId: ficha.tecnicoId,
        localId: ficha.localId ?? p.localId, localNombre: ficha.localNombre ?? p.localNombre,
      };
    }

    throw new AccesoDenegadoError('Tu usuario no tiene acceso a esta aplicación. Consulta con el jefe de taller.');
  }
}
