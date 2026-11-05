import sharp from 'sharp';
import type { EntradaRedaccion, Redaccion, RedactorInforme } from '../../application/ports/RedactorInforme.js';
import { ServicioExternoError } from '../errors/ServicioExternoError.js';

/**
 * ADAPTADOR: redacta el informe con Google Gemini.
 *
 * Mismo enfoque que GeminiFotoClient.java de Control de Personal:
 *  - "structured output": se le exige un JSON con forma fija (ESQUEMA).
 *  - Lista de modelos: si uno responde 429/503 (límite o saturado) se prueba el siguiente.
 *  - Las descripciones del esquema llevan tildes a propósito: sin ejemplos,
 *    en modo JSON el modelo tiende a escribir sin tildes.
 */
const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    motivo: {
      type: 'STRING',
      description:
        'Motivo del informe en MAYÚSCULAS. Si la OT es de mantenimiento periódico usa «MANTENIMIENTO PREVENTIVO <km> KM» (ej.: «MANTENIMIENTO PREVENTIVO 135000 KM»); si no, el trabajo principal, ej.: «DIAGNÓSTICO DE SISTEMA DE FRENOS».',
    },
    tituloFotoPrincipal: {
      type: 'STRING',
      description: 'Título corto en MAYÚSCULAS sobre la foto principal, ej.: «MANTENIMIENTO PREVENTIVO».',
    },
    condicion: {
      type: 'STRING',
      description: 'Estado del vehículo al ingresar o trabajo realizado, 1 o 2 oraciones, ej.: «Se realizó el mantenimiento preventivo de 135000 km.».',
    },
    diagnosticoIntro: {
      type: 'STRING',
      description: 'Frase que introduce las observaciones, ej.: «Durante la inspección efectuada como parte del mantenimiento se identificó las siguientes observaciones:».',
    },
    observaciones: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Hallazgos del técnico, uno por elemento, sin numerar, ej.: «Fluido de dirección contaminado.», «Foco quemado de luz de placa.».',
    },
    conclusion: {
      type: 'STRING',
      description: 'Solución del problema en una oración, ej.: «Se reemplazó los repuestos mencionados para mantener la operatividad de la unidad.».',
    },
    recomendaciones: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Recomendaciones al cliente, solo si se desprenden del reporte; puede quedar vacía.',
    },
    leyendas: {
      type: 'ARRAY',
      description:
        'Una leyenda por foto, máx. 10 palabras, en estilo de informe (sustantivo + complemento), ej.: «Reemplazo de filtro de A/C.», «Medida de neumáticos delanteros: 6.9 mm.», «Medida de pastillas. Buen estado», «Luz de placa no enciende», «Reemplazo de focos lágrima».',
      items: {
        type: 'OBJECT',
        properties: { numero: { type: 'INTEGER' }, leyenda: { type: 'STRING' } },
        required: ['numero', 'leyenda'],
      },
    },
  },
  required: ['motivo', 'tituloFotoPrincipal', 'condicion', 'diagnosticoIntro', 'observaciones', 'conclusion', 'recomendaciones', 'leyendas'],
};

interface Config {
  apiKey: string;
  urlBase: string;
  modelos: string[];
  timeoutSegundos: number;
}

export class GeminiRedactorInforme implements RedactorInforme {
  constructor(private readonly cfg: Config) {}

  async redactar(e: EntradaRedaccion): Promise<Redaccion> {
    const partes: object[] = [{ text: this.instrucciones(e) }];
    for (const f of e.fotos) {
      partes.push({ text: `Foto ${f.numero}. Descripción del técnico: ${f.descripcionTecnico || '(sin descripción)'}` });
      partes.push({ inline_data: { mime_type: 'image/jpeg', data: (await reducir(f.imagen)).toString('base64') } });
    }
    const cuerpo = JSON.stringify({
      contents: [{ parts: partes }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0.3 },
    });

    const errores: string[] = [];
    // Hasta 2 vueltas por la lista de modelos: los 503/429 de Gemini suelen ser picos pasajeros
    for (let vuelta = 1; vuelta <= 2; vuelta++) {
      let saturados = 0;
      for (const modelo of this.cfg.modelos) {
        try {
          const res = await fetch(`${this.cfg.urlBase}/models/${modelo}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.cfg.apiKey },
            body: cuerpo,
            signal: AbortSignal.timeout(this.cfg.timeoutSegundos * 1000),
          });
          if (!res.ok) {
            if (res.status === 503 || res.status === 429) saturados++;
            errores.push(`${modelo}: HTTP ${res.status}`);
            continue;
          }
          const r = this.extraer(await res.json());
          if (r) return { ...r, modelo };
          errores.push(`${modelo}: respuesta sin contenido utilizable`);
        } catch (err) {
          errores.push(`${modelo}: ${(err as Error).message}`);
        }
      }
      if (saturados === 0) break; // falló por otra causa (clave, formato): reintentar no sirve
      if (vuelta === 1) await new Promise((r) => setTimeout(r, 4000));
    }
    throw new ServicioExternoError(`La IA no pudo redactar el informe (${errores.join('; ')})`, undefined, 'de IA (Gemini)');
  }

  private instrucciones(e: EntradaRedaccion): string {
    return [
      'Eres el jefe de taller de PINEDA AUTOMOTRIZ (taller automotriz autorizado en Perú).',
      'Redacta el INFORME TÉCNICO que se entrega al cliente, en español formal y con tildes.',
      'Reglas:',
      '- Básate SOLO en lo que reporta el técnico y en lo que se ve en las fotos. No inventes medidas, cifras ni trabajos.',
      '- CONSERVA los nombres de piezas que usa el técnico (ej. «foco lágrima», «hidrolina», «zapatas»): solo corrige ortografía,',
      '  tildes y abreviaturas («mantto» → mantenimiento, «izq» → izquierdo/LH). Nunca cambies una pieza por otra.',
      '- Si el técnico indica el estado de algo (bueno, malo, desgastado), mantenlo.',
      '- Redacción breve, formal y en tercera persona impersonal, como un informe de taller.',
      '- Las leyendas de fotos deben ir en el mismo orden y número que las fotos recibidas.',
      '',
      'Ejemplos de estilo del taller (texto del técnico → texto del informe):',
      '  «cambio filtro ac, estaba sucio» → «Reemplazo de filtro de A/C.»',
      '  «pastillas 8.1mm buen estado» → «Medida de pastillas: 8.1 mm. Buen estado»',
      '  «hidrolina contaminada mal estado» → «ATF de dirección contaminado. Mal estado»',
      '  «luz placa no prende» → «Luz de placa no enciende»',
      '  «se cambio foco luz placa» → «Reemplazo de luz de placa»',
      '  Observación: «Foco quemado de luz de posición de faro delantero LH.»',
      '  Conclusión: «Se reemplazó los repuestos mencionados para mantener la operatividad de la unidad.»',
      '',
      `Vehículo: ${e.vehiculo}`,
      `Kilometraje: ${e.kilometraje ?? 'no indicado'}`,
      `Servicio de la OT: ${e.servicio ?? 'no indicado'} (tipo: ${e.tipoOt ?? 'no indicado'})`,
      `Actividades registradas en la OT:\n${e.actividadesOT.map((a) => `  - ${a}`).join('\n') || '  (ninguna)'}`,
      '',
      `Requerimiento / diagnóstico escrito por el técnico:\n"""${e.requerimientoTecnico}"""`,
      '',
      `A continuación ${e.fotos.length} fotos, cada una con la descripción del técnico:`,
    ].join('\n');
  }

  /** El JSON llega como texto en candidates[0].content.parts (se ignoran las partes de "pensamiento"). */
  private extraer(json: unknown): Omit<Redaccion, 'modelo'> | null {
    const partes = (json as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] })
      ?.candidates?.[0]?.content?.parts ?? [];
    const texto = partes.filter((p) => !p.thought && p.text).map((p) => p.text).join('');
    if (!texto) return null;
    try {
      const d = JSON.parse(texto);
      const lista = (x: unknown) => (Array.isArray(x) ? x.map(String).map((s) => s.trim()).filter(Boolean) : []);
      return {
        motivo: String(d.motivo ?? '').trim(),
        tituloFotoPrincipal: String(d.tituloFotoPrincipal ?? '').trim(),
        condicion: String(d.condicion ?? '').trim(),
        diagnosticoIntro: String(d.diagnosticoIntro ?? '').trim(),
        observaciones: lista(d.observaciones),
        conclusion: String(d.conclusion ?? '').trim(),
        recomendaciones: lista(d.recomendaciones),
        leyendas: Array.isArray(d.leyendas)
          ? d.leyendas.map((l: { numero: number; leyenda: string }) => ({ numero: Number(l.numero), leyenda: String(l.leyenda ?? '').trim() }))
          : [],
      };
    } catch {
      return null;
    }
  }
}

/**
 * Foto más liviana solo para que la IA la "vea" (1024 px, ~100 KB).
 * El Word usa las fotos originales; esto reduce la petición de ~6 MB a <2 MB,
 * que es lo primero que Gemini rechaza cuando está saturado.
 */
async function reducir(imagen: Buffer): Promise<Buffer> {
  return sharp(imagen).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
}
