/**
 * Roles de ESTA aplicación. No son los roles del sistema de Control de
 * Personal: el caso de uso IniciarSesion traduce de uno a otro.
 */
export type Rol = 'TECNICO' | 'JEFE_TALLER';

/** Usuario con sesión iniciada (lo que viaja dentro de nuestro token). */
export interface UsuarioSesion {
  id: number; // id de usuario en Control de Personal
  nombre: string;
  email: string;
  rol: Rol;
  tecnicoId: number | null; // solo técnicos: es el que aparece en OT.tecnicoId
  localId: number | null;
}

export const esJefe = (u: UsuarioSesion) => u.rol === 'JEFE_TALLER';
