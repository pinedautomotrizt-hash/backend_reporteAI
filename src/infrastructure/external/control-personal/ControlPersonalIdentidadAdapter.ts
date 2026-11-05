import type {
  FichaTecnico,
  IdentidadExterna,
  ProveedorIdentidad,
} from '../../../application/ports/ProveedorIdentidad.js';
import type { ControlPersonalClient } from './ControlPersonalClient.js';

interface TecnicoApi {
  id: number;
  usuarioId: number;
  usuarioEmail?: string | null;
  nombre: string;
  localId: number | null;
  activo: boolean;
}

const CACHE_TECNICOS_MS = 5 * 60 * 1000;

/**
 * ADAPTADOR: implementa ProveedorIdentidad usando Control de Personal.
 *  - autenticar: reenvía email/contraseña al login de Control de Personal.
 *    Nunca guardamos contraseñas: solo preguntamos "¿es correcta?".
 *  - buscarTecnicoPorUsuario: usa /api/tecnicos (con caché de 5 min) para
 *    saber qué tecnicoId le corresponde a ese usuario.
 */
export class ControlPersonalIdentidadAdapter implements ProveedorIdentidad {
  private cacheTecnicos: { datos: TecnicoApi[]; expira: number } | null = null;

  constructor(private readonly client: ControlPersonalClient) {}

  async autenticar(email: string, password: string): Promise<IdentidadExterna | null> {
    const res = await this.client.loginUsuario(email, password);
    if (!res) return null;

    // Preferimos el objeto "usuario" de la respuesta; si no viene, leemos el JWT.
    // Es seguro leer el JWT sin verificar la firma porque lo acabamos de recibir
    // directamente del servidor por HTTPS (no viene del navegador).
    const jwt = leerPayloadJwt(res.token);
    const usuarioId = res.usuario?.id ?? Number(jwt.userId);
    if (!Number.isFinite(usuarioId)) return null;

    return {
      usuarioId,
      nombre: res.usuario?.nombre ?? String(jwt.nombre ?? email),
      email: res.usuario?.email ?? String(jwt.sub ?? email),
      rolSistema: res.usuario?.rol ?? String(jwt.rol ?? ''),
    };
  }

  async buscarTecnicoPorUsuario(usuarioId: number): Promise<FichaTecnico | null> {
    return (await this.listarTecnicos()).find((t) => t.usuarioId === usuarioId) ?? null;
  }

  async listarTecnicos(): Promise<FichaTecnico[]> {
    return (await this.tecnicosApi()).map((t) => ({
      tecnicoId: t.id,
      usuarioId: t.usuarioId,
      nombre: t.nombre,
      email: t.usuarioEmail ?? null,
      localId: t.localId,
      activo: t.activo,
    }));
  }

  private async tecnicosApi(): Promise<TecnicoApi[]> {
    if (this.cacheTecnicos && Date.now() < this.cacheTecnicos.expira) return this.cacheTecnicos.datos;
    const datos = (await this.client.get<TecnicoApi[]>('/api/tecnicos')) ?? [];
    this.cacheTecnicos = { datos, expira: Date.now() + CACHE_TECNICOS_MS };
    return datos;
  }
}

function leerPayloadJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}
