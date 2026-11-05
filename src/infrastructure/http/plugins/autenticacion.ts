import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { EmisorTokens } from '../../../application/ports/EmisorTokens.js';
import type { Rol, UsuarioSesion } from '../../../domain/entities/Usuario.js';

declare module 'fastify' {
  interface FastifyRequest {
    usuario: UsuarioSesion | null;
  }
}

/**
 * Crea el "guardia" que se pone delante de las rutas privadas.
 * Lee el header  Authorization: Bearer <token>, lo valida y deja el
 * usuario en req.usuario. Si se indican roles, también los exige.
 */
export function crearGuardia(tokens: EmisorTokens) {
  return function requiereSesion(...roles: Rol[]): preHandlerHookHandler {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const [tipo, token] = (req.headers.authorization ?? '').split(' ');
      const usuario = tipo === 'Bearer' && token ? await tokens.verificar(token) : null;

      if (!usuario) {
        return reply.status(401).send({ error: 'Sesión expirada o inválida. Vuelve a iniciar sesión.' });
      }
      if (roles.length && !roles.includes(usuario.rol)) {
        return reply.status(403).send({ error: 'No tienes permiso para esta acción' });
      }
      req.usuario = usuario;
    };
  };
}

export type RequiereSesion = ReturnType<typeof crearGuardia>;

/** Para usar dentro de rutas ya protegidas por el guardia. */
export function usuarioDe(req: FastifyRequest): UsuarioSesion {
  if (!req.usuario) throw new Error('Ruta sin guardia de sesión');
  return req.usuario;
}
