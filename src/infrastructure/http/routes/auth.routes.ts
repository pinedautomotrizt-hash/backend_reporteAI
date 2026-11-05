import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IniciarSesion } from '../../../application/use-cases/IniciarSesion.js';
import { usuarioDe, type RequiereSesion } from '../plugins/autenticacion.js';

export interface AuthDeps {
  iniciarSesion: IniciarSesion;
  requiereSesion: RequiereSesion;
}

const bodyLogin = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

/**
 *   POST /api/auth/login   { email, password }  ->  { token, usuario }
 *   GET  /api/auth/me                           ->  usuario de la sesión
 */
export function authRoutes(deps: AuthDeps) {
  return async (app: FastifyInstance) => {
    app.post(
      '/api/auth/login',
      // Máx. 10 intentos por minuto por IP: frena a quien intente adivinar contraseñas
      { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
      async (req) => {
        const { email, password } = bodyLogin.parse(req.body);
        return deps.iniciarSesion.ejecutar(email, password);
      },
    );

    app.get('/api/auth/me', { preHandler: deps.requiereSesion() }, async (req) => usuarioDe(req));
  };
}
