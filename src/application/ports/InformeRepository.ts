import type { InformeTecnico } from '../../domain/entities/InformeTecnico.js';

/** PUERTO DE SALIDA: dónde se guarda el borrador/versión final del informe. */
export interface InformeRepository {
  obtener(reporteId: string): Promise<InformeTecnico | null>;
  guardar(informe: InformeTecnico): Promise<void>;
}
