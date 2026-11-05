import type { UsuarioSesion } from '../../domain/entities/Usuario.js';

/** PUERTO DE SALIDA: crear y validar los tokens de sesión de ESTA app. */
export interface EmisorTokens {
  emitir(usuario: UsuarioSesion): Promise<string>;
  /** Devuelve el usuario si el token es válido y no venció; null si no. */
  verificar(token: string): Promise<UsuarioSesion | null>;
}
