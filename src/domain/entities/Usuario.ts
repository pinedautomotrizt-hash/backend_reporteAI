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
  // Sede (local) del usuario en Control de Personal: 1 Trujillo, 2 Callao...
  // null = ve todas las sedes (solo el admin).
  localId: number | null;
  localNombre: string | null;
}

/** ¿El usuario puede ver datos de esa sede? (null en el usuario = todas) */
export const veLocal = (u: UsuarioSesion, localId: number | null | undefined) =>
  u.localId === null || u.localId === localId;

export const esJefe = (u: UsuarioSesion) => u.rol === 'JEFE_TALLER';
