import type { EntradaRedaccion, Redaccion, RedactorInforme } from '../../application/ports/RedactorInforme.js';

/**
 * ADAPTADOR DE RESPALDO: se usa cuando no hay GEMINI_API_KEY.
 * No redacta nada: arma el borrador con el texto tal cual lo escribió el
 * técnico, para que el jefe lo complete a mano. La app sigue funcionando.
 */
export class SinIaRedactorInforme implements RedactorInforme {
  async redactar(e: EntradaRedaccion): Promise<Redaccion> {
    const esMantenimiento = /manten|mantto|mp\d/i.test(`${e.servicio} ${e.tipoOt}`);
    return {
      motivo: (e.servicio ?? 'INFORME TÉCNICO').toUpperCase(),
      tituloFotoPrincipal: esMantenimiento ? 'MANTENIMIENTO PREVENTIVO' : 'EVALUACIÓN DE UNIDAD',
      condicion: '',
      diagnosticoIntro: 'Durante la inspección se identificaron las siguientes observaciones:',
      observaciones: e.requerimientoTecnico.split(/\r?\n/).map((l) => l.replace(/^\s*[-•\d.)]+\s*/, '').trim()).filter(Boolean),
      conclusion: '',
      recomendaciones: [],
      leyendas: e.fotos.map((f) => ({ numero: f.numero, leyenda: f.descripcionTecnico })),
      modelo: 'sin-ia',
    };
  }
}
