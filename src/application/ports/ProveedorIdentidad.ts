/**
 * PUERTO DE SALIDA: "¿quién es esta persona?".
 * Hoy lo responde Control de Personal; si algún día la app tiene sus
 * propios usuarios, se crea otro adaptador y los casos de uso no cambian.
 */
export interface IdentidadExterna {
  usuarioId: number;
  nombre: string;
  email: string;
  rolSistema: string; // rol tal cual viene del sistema externo ("admin", ...)
}

export interface FichaTecnico {
  tecnicoId: number;
  usuarioId: number;
  nombre: string;
  email: string | null;
  localId: number | null;
  activo: boolean;
}

export interface ProveedorIdentidad {
  /** Devuelve la identidad si las credenciales son correctas; null si no. */
  autenticar(email: string, password: string): Promise<IdentidadExterna | null>;

  /** Ficha de técnico asociada a un usuario, o null si no es técnico. */
  buscarTecnicoPorUsuario(usuarioId: number): Promise<FichaTecnico | null>;

  /** Todos los técnicos registrados. */
  listarTecnicos(): Promise<FichaTecnico[]>;
}
