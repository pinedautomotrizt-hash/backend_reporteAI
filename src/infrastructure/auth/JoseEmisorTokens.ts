import { SignJWT, jwtVerify } from 'jose';
import type { EmisorTokens } from '../../application/ports/EmisorTokens.js';
import type { Rol, UsuarioSesion } from '../../domain/entities/Usuario.js';

/**
 * ADAPTADOR: tokens JWT propios de esta app, firmados con JWT_SECRET.
 *
 * ¿Por qué no usar el token de Control de Personal directamente?
 *  - Nuestro token lleva NUESTRO rol (TECNICO / JEFE_TALLER) y el tecnicoId.
 *  - El navegador nunca recibe un token con permisos sobre Control de Personal.
 */
export class JoseEmisorTokens implements EmisorTokens {
  private readonly clave: Uint8Array;

  constructor(secreto: string, private readonly duracion = '10h') {
    this.clave = new TextEncoder().encode(secreto);
  }

  async emitir(u: UsuarioSesion): Promise<string> {
    return new SignJWT({ nombre: u.nombre, email: u.email, rol: u.rol, tecnicoId: u.tecnicoId, localId: u.localId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(u.id))
      .setIssuedAt()
      .setExpirationTime(this.duracion)
      .sign(this.clave);
  }

  async verificar(token: string): Promise<UsuarioSesion | null> {
    try {
      const { payload: p } = await jwtVerify(token, this.clave, { algorithms: ['HS256'] });
      return {
        id: Number(p.sub),
        nombre: String(p.nombre),
        email: String(p.email),
        rol: p.rol as Rol,
        tecnicoId: (p.tecnicoId as number | null) ?? null,
        localId: (p.localId as number | null) ?? null,
      };
    } catch {
      return null; // firma inválida, vencido o mal formado
    }
  }
}
