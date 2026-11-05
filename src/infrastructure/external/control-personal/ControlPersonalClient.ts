/**
 * Cliente HTTP del sistema de Control de Personal.
 *
 * Se encarga SOLO de la comunicación: login, guardar el token en memoria,
 * renovarlo antes de que venza y reintentar una vez si la API responde 401.
 */
import { ServicioExternoError } from '../../errors/ServicioExternoError.js';
export { ServicioExternoError };

interface Credenciales {
  baseUrl: string;
  email: string;
  password: string;
}

const MARGEN_RENOVACION_MS = 5 * 60 * 1000; // renovar 5 min antes de vencer
const TIMEOUT_MS = 15_000;

export class ControlPersonalClient {
  private token: string | null = null;
  private venceEn = 0;
  private loginEnCurso: Promise<string> | null = null;

  constructor(private readonly cfg: Credenciales) {}

  async get<T>(ruta: string): Promise<T | null> {
    let res = await this.peticion(ruta, await this.obtenerToken());

    if (res.status === 401) {
      // token revocado o vencido antes de lo esperado: login de nuevo y reintentar una vez
      this.token = null;
      res = await this.peticion(ruta, await this.obtenerToken());
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ServicioExternoError(`Control de Personal respondió ${res.status} en ${ruta}`, res.status);
    }
    return (await res.json()) as T;
  }

  private peticion(ruta: string, token: string) {
    return fetch(`${this.cfg.baseUrl}${ruta}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((e: Error) => {
      throw new ServicioExternoError(`No se pudo conectar con Control de Personal: ${e.message}`);
    });
  }

  private async obtenerToken(): Promise<string> {
    if (this.token && Date.now() < this.venceEn - MARGEN_RENOVACION_MS) return this.token;
    // Si llegan varias peticiones a la vez, todas esperan el mismo login
    this.loginEnCurso ??= this.login().finally(() => (this.loginEnCurso = null));
    return this.loginEnCurso;
  }

  /** Login de la CUENTA DE SERVICIO (la de .env) que usa el backend para leer datos. */
  private async login(): Promise<string> {
    const datos = await this.loginUsuario(this.cfg.email, this.cfg.password);
    if (!datos) {
      throw new ServicioExternoError('La cuenta de servicio de Control de Personal fue rechazada. Revisa CONTROL_PERSONAL_EMAIL/PASSWORD.');
    }
    this.token = datos.token;
    this.venceEn = Date.now() + (datos.expiresInMs ?? 60 * 60 * 1000);
    return datos.token;
  }

  /**
   * Login de CUALQUIER usuario (técnico o jefe) para validar su contraseña.
   * Devuelve null si las credenciales son incorrectas.
   */
  async loginUsuario(email: string, password: string): Promise<RespuestaLogin | null> {
    const res = await fetch(`${this.cfg.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((e: Error) => {
      throw new ServicioExternoError(`No se pudo conectar con Control de Personal: ${e.message}`);
    });

    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) throw new ServicioExternoError(`Login en Control de Personal respondió ${res.status}`, res.status);
    return (await res.json()) as RespuestaLogin;
  }
}

export interface RespuestaLogin {
  token: string;
  expiresInMs?: number;
  usuario?: { id: number; nombre: string; email: string; rol: string };
}
