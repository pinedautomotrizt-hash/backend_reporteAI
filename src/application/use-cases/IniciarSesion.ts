import type { ProveedorIdentidad } from '../ports/ProveedorIdentidad.js';
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

    const usuario = await this.resolverRol(persona.usuarioId, persona.nombre, persona.email, persona.rolSistema);
    const token = await this.tokens.emitir(usuario);
    return { token, usuario };
  }

  private async resolverRol(id: number, nombre: string, email: string, rolSistema: string): Promise<UsuarioSesion> {
    if (this.rolesJefe.includes(rolSistema.toLowerCase())) {
      return { id, nombre, email, rol: 'JEFE_TALLER', tecnicoId: null, localId: null };
    }

    const ficha = await this.identidad.buscarTecnicoPorUsuario(id);
    if (ficha?.activo) {
      return { id, nombre: ficha.nombre, email, rol: 'TECNICO', tecnicoId: ficha.tecnicoId, localId: ficha.localId };
    }

    throw new AccesoDenegadoError('Tu usuario no tiene acceso a esta aplicación. Consulta con el jefe de taller.');
  }
}
