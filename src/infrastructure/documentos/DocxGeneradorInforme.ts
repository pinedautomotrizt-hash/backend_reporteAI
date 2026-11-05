import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
} from 'docx';
import sharp from 'sharp';
import type { GeneradorDocumento, ImagenParaDocumento } from '../../application/ports/GeneradorDocumento.js';
import type { ContenidoInforme, ItemCantidad } from '../../domain/entities/InformeTecnico.js';

/**
 * ADAPTADOR: arma el INFORME TÉCNICO en Word (.docx) con la plantilla de
 * Pineda Automotriz:
 *   - Encabezado en todas las páginas (título, taller, motivo, fecha, OT, Pág. X/Y)
 *   - Pág. 1: datos del vehículo + foto principal, condición, diagnóstico,
 *     conclusión, recomendaciones, repuestos, mano de obra y firmas
 *   - Págs. siguientes: anexo fotográfico, 2 fotos por fila con su leyenda
 *
 * Medidas en DXA (1440 = 1 pulgada). Página A4.
 */
const PAGINA = { ancho: 11906, alto: 16838 };
const MARGEN = 680;
const ANCHO = PAGINA.ancho - MARGEN * 2; // 10546

const FUENTE = 'Arial';
const T = 17; // tamaño base en medios puntos (8.5 pt)
const AZUL = '1F3A93';
const ROJO = 'E00000';
const GRIS = 'D9D9D9';
const GRIS_CLARO = 'F2F2F2';

const borde: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const sinBorde: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDES = { top: borde, bottom: borde, left: borde, right: borde };
const SIN_BORDES = { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde };

interface OpcTexto {
  negrita?: boolean;
  color?: string;
  tam?: number;
  alinear?: (typeof AlignmentType)[keyof typeof AlignmentType];
}

const texto = (t: string, o: OpcTexto = {}) =>
  new Paragraph({
    alignment: o.alinear ?? AlignmentType.LEFT,
    spacing: { before: 10, after: 10 },
    children: [new TextRun({ text: t, bold: o.negrita, color: o.color, size: o.tam ?? T, font: FUENTE })],
  });

interface OpcCelda extends OpcTexto {
  ancho: number;
  sombra?: string;
  colSpan?: number;
  rowSpan?: number;
  sinBordes?: boolean;
  vertical?: (typeof VerticalAlign)["TOP" | "CENTER" | "BOTTOM"];
}

function celda(contenido: string | Paragraph[], o: OpcCelda) {
  return new TableCell({
    width: { size: o.ancho, type: WidthType.DXA },
    columnSpan: o.colSpan,
    rowSpan: o.rowSpan,
    verticalAlign: o.vertical ?? VerticalAlign.CENTER,
    borders: o.sinBordes ? SIN_BORDES : BORDES,
    shading: o.sombra ? { type: ShadingType.CLEAR, color: 'auto', fill: o.sombra } : undefined,
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: typeof contenido === 'string' ? [texto(contenido, o)] : contenido,
  });
}

function tabla(columnas: number[], filas: TableRow[], sinBordes = false) {
  return new Table({
    width: { size: columnas.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: columnas,
    layout: TableLayoutType.FIXED,
    borders: sinBordes
      ? { ...SIN_BORDES, insideHorizontal: sinBorde, insideVertical: sinBorde }
      : { ...BORDES, insideHorizontal: borde, insideVertical: borde },
    rows: filas,
  });
}

const espacio = (pt = 4) => new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', size: pt * 2 })] });

export class DocxGeneradorInforme implements GeneradorDocumento {
  readonly extension = 'docx';
  readonly tipoMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  async generar(c: ContenidoInforme, imagenes: ImagenParaDocumento[]): Promise<Buffer> {
    const fotos = new Map(imagenes.map((i) => [i.fotoId, i.datos]));

    const principal = c.fotoPrincipalId ? fotos.get(c.fotoPrincipalId) : undefined;
    const anexo = c.fotos.filter((f) => fotos.has(f.fotoId));

    const pagina1 = [
      await this.datosVehiculo(c, principal),
      espacio(),
      this.condicionHistorial(c),
      this.seccion('Diagnóstico (Detalles de la inspección / Resultados)', [
        ...(c.diagnosticoIntro ? [texto(c.diagnosticoIntro, { color: AZUL })] : []),
        ...c.observaciones.map((o, i) => texto(`${i + 1}. ${o}`, { color: AZUL })),
        ...(c.observaciones.length ? [] : [texto(' ')]),
      ]),
      this.seccion('CONCLUSIÓN (solución del problema)', [texto(c.conclusion || ' ', { negrita: true, color: ROJO })]),
      espacio(),
      this.seccion('RECOMENDACIONES', c.recomendaciones.length
        ? c.recomendaciones.map((r, i) => texto(`${i + 1}. ${r}`, { color: AZUL }))
        : [texto(' ')]),
      espacio(),
      this.tablaItems('REPUESTOS', 'CANTIDAD', c.repuestos),
      espacio(),
      this.tablaItems('MANO DE OBRA:', 'HORA/HOMBRE', c.manoObra),
      espacio(4),
      this.firmas(c),
    ];

    // Cada sección empieza en página nueva y repite el encabezado; la numeración continúa.
    // (Un salto de página manual dejaba una hoja en blanco cuando la pág. 1 se llenaba justo.)
    const seccion = (children: (Paragraph | Table)[]) => ({
      properties: {
        page: {
          size: { width: PAGINA.ancho, height: PAGINA.alto },
          margin: { top: 2550, bottom: 600, left: MARGEN, right: MARGEN, header: 400 },
        },
      },
      headers: { default: this.encabezado(c) },
      children,
    });

    const doc = new Document({
      creator: 'Pineda Automotriz - Reportes técnicos',
      title: `Informe técnico ${c.placa}`,
      styles: { default: { document: { run: { font: FUENTE, size: T } } } },
      sections: [seccion(pagina1), ...(anexo.length ? [seccion([await this.anexoFotos(anexo, fotos)])] : [])],
    });
    return Packer.toBuffer(doc);
  }

  // ---------- encabezado (todas las páginas) ----------

  private encabezado(c: ContenidoInforme) {
    const [anio, mes, dia] = c.fecha.split('-');
    const col = [1130, 1130, 1140, 3300, 2146, 1700];
    return new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ children: ['Pág. ', PageNumber.CURRENT, '/', PageNumber.TOTAL_PAGES], size: 14, font: FUENTE }),
          ],
        }),
        texto('INFORME TÉCNICO', { negrita: true, tam: 32, alinear: AlignmentType.CENTER }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'TALLER AUTORIZADO        ', bold: true, size: 15, font: FUENTE }),
            new TextRun({ text: 'PINEDA AUTOMOTRIZ', bold: true, size: 22, color: ROJO, font: FUENTE }),
            new TextRun({ text: '        SEDE: ', bold: true, size: 15, font: FUENTE }),
            new TextRun({ text: c.sede, bold: true, size: 15, color: ROJO, font: FUENTE }),
          ],
        }),
        tabla(col, [
          new TableRow({
            children: [
              celda('MOTIVO:', { ancho: 3400, colSpan: 3, negrita: true, alinear: AlignmentType.CENTER }),
              celda(c.motivo, { ancho: 7146, colSpan: 3, negrita: true, tam: 24, alinear: AlignmentType.CENTER }),
            ],
          }),
          new TableRow({
            children: [
              celda('FECHA', { ancho: 3400, colSpan: 3, negrita: true, tam: 14, alinear: AlignmentType.CENTER }),
              celda('RESPONSABLE:', { ancho: col[3], negrita: true, tam: 14 }),
              celda('Evaluación de unidad', { ancho: col[4], rowSpan: 2, negrita: true, tam: 14, alinear: AlignmentType.CENTER }),
              celda('O/T Nº', { ancho: col[5], negrita: true, tam: 14 }),
            ],
          }),
          new TableRow({
            children: [
              celda(String(Number(dia)), { ancho: col[0], tam: 14, alinear: AlignmentType.CENTER }),
              celda(String(Number(mes)), { ancho: col[1], tam: 14, alinear: AlignmentType.CENTER }),
              celda(anio ?? '', { ancho: col[2], tam: 14, alinear: AlignmentType.CENTER }),
              celda(c.responsable, { ancho: col[3], negrita: true, color: AZUL, tam: 14, alinear: AlignmentType.CENTER }),
              celda(c.nroOrden, { ancho: col[5], negrita: true, color: AZUL, tam: 15, alinear: AlignmentType.CENTER }),
            ],
          }),
        ]),
      ],
    });
  }

  // ---------- página 1 ----------

  private async datosVehiculo(c: ContenidoInforme, foto?: Buffer) {
    const col = [1900, 3100, 5546];
    const datos: [string, string, boolean?][] = [
      ['Marca', c.marca],
      ['Modelo', c.modelo],
      ['Placa de rodaje', c.placa, true],
      ['Nro. de VIN', c.vin],
      ['Kilometraje', c.kilometraje],
      ['Año - Modelo', c.anioModelo],
      ['Fecha de Ingreso', c.fechaIngreso],
      ['Nombre o Razón Social', c.cliente],
    ];

    const imagen = foto
      ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [await this.imagen(foto, 350, 215)] })]
      : [texto('(sin foto)', { alinear: AlignmentType.CENTER, color: '999999' })];

    return tabla(col, [
      new TableRow({
        children: [
          celda('Datos del Vehículo', { ancho: col[0] + col[1], colSpan: 2, sombra: GRIS, negrita: true, tam: 20, alinear: AlignmentType.CENTER }),
          celda(c.tituloFotoPrincipal, { ancho: col[2], sombra: GRIS, negrita: true, tam: 20, alinear: AlignmentType.CENTER }),
        ],
      }),
      ...datos.map(
        ([etiqueta, valor, destacado], i) =>
          new TableRow({
            children: [
              celda(etiqueta, { ancho: col[0], sombra: GRIS_CLARO, tam: 15 }),
              celda(valor || ' ', { ancho: col[1], color: AZUL, negrita: destacado, tam: destacado ? 19 : T, alinear: AlignmentType.CENTER }),
              ...(i === 0 ? [celda(imagen, { ancho: col[2], rowSpan: datos.length + 2, alinear: AlignmentType.CENTER })] : []),
            ],
          }),
      ),
      new TableRow({
        children: [celda('Voz del Cliente', { ancho: col[0] + col[1], colSpan: 2, sombra: GRIS_CLARO, negrita: true, alinear: AlignmentType.CENTER })],
      }),
      new TableRow({
        height: { value: 600, rule: 'atLeast' },
        children: [celda(c.vozCliente || ' ', { ancho: col[0] + col[1], colSpan: 2, color: AZUL, alinear: AlignmentType.CENTER })],
      }),
    ]);
  }

  private condicionHistorial(c: ContenidoInforme) {
    const col = [6600, 3946];
    return tabla(col, [
      new TableRow({
        children: [
          celda([new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Condición ', bold: true, size: T, font: FUENTE }),
              new TextRun({ text: '(Estado del vehículo al ingresar al taller)', size: T, font: FUENTE }),
            ],
          })], { ancho: col[0], sombra: GRIS }),
          celda('Historial', { ancho: col[1], sombra: GRIS, negrita: true, alinear: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        height: { value: 350, rule: 'atLeast' },
        children: [
          celda(c.condicion || ' ', { ancho: col[0], color: AZUL, vertical: VerticalAlign.TOP }),
          celda(c.historial || ' ', { ancho: col[1], color: AZUL, vertical: VerticalAlign.TOP }),
        ],
      }),
    ]);
  }

  private seccion(titulo: string, cuerpo: Paragraph[]) {
    return tabla([ANCHO], [
      new TableRow({ children: [celda(titulo, { ancho: ANCHO, sombra: GRIS, negrita: true })] }),
      new TableRow({ height: { value: 300, rule: 'atLeast' }, children: [celda(cuerpo, { ancho: ANCHO, vertical: VerticalAlign.TOP })] }),
    ]);
  }

  private tablaItems(titulo: string, tituloCantidad: string, items: ItemCantidad[]) {
    const col = [2300, 6546, 1700];
    const filas = [...items];
    while (filas.length < 3) filas.push({ descripcion: '', cantidad: '' }); // mínimo 3 filas, como la plantilla
    return tabla(col, [
      new TableRow({
        children: [
          celda(titulo, { ancho: col[0], sombra: GRIS, negrita: true, alinear: AlignmentType.CENTER }),
          celda('DESCRIPCIÓN', { ancho: col[1], sombra: GRIS, negrita: true, alinear: AlignmentType.CENTER }),
          celda(tituloCantidad, { ancho: col[2], sombra: GRIS, negrita: true, alinear: AlignmentType.CENTER }),
        ],
      }),
      ...filas.map(
        (it, i) =>
          new TableRow({
            children: [
              ...(i === 0 ? [celda(' ', { ancho: col[0], rowSpan: filas.length })] : []),
              celda(it.descripcion || ' ', { ancho: col[1], negrita: true }),
              celda(it.cantidad || ' ', { ancho: col[2], negrita: true, alinear: AlignmentType.CENTER }),
            ],
          }),
      ),
    ]);
  }

  private firmas(c: ContenidoInforme) {
    const mitad = ANCHO / 2;
    const bloque = (nombre: string, cargo: string) => [
      espacio(14),
      texto('________________________________', { alinear: AlignmentType.CENTER }),
      texto(nombre, { negrita: true, alinear: AlignmentType.CENTER }),
      texto(cargo, { negrita: true, tam: 14, alinear: AlignmentType.CENTER }),
    ];
    return tabla([mitad, mitad], [
      // cantSplit: la caja de firmas nunca se parte entre dos páginas
      new TableRow({
        cantSplit: true,
        children: [
          celda(bloque(c.jefeNombre, c.jefeCargo), { ancho: mitad }),
          celda(bloque(c.tecnicoNombre, 'TÉCNICO DIAGNÓSTICO'), { ancho: mitad }),
        ],
      }),
    ]);
  }

  // ---------- anexo fotográfico ----------

  private async anexoFotos(lista: ContenidoInforme['fotos'], fotos: Map<string, Buffer>) {
    const mitad = ANCHO / 2;
    const celdas = await Promise.all(
      lista.map(async (f, i) =>
        celda(
          [
            texto(`${i + 1}. ${f.leyenda}`, { tam: 18 }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [await this.imagen(fotos.get(f.fotoId)!, 330, 255)] }),
          ],
          { ancho: mitad, sinBordes: true, vertical: VerticalAlign.TOP },
        ),
      ),
    );
    const filas: TableRow[] = [];
    for (let i = 0; i < celdas.length; i += 2) {
      filas.push(new TableRow({
        cantSplit: true,
        children: [celdas[i], celdas[i + 1] ?? celda(' ', { ancho: mitad, sinBordes: true })],
      }));
    }
    return tabla([mitad, mitad], filas, true);
  }

  /** Inserta la imagen ajustada dentro de una caja (máx. ancho × alto en píxeles), sin deformarla. */
  private async imagen(datos: Buffer, maxAncho: number, maxAlto: number) {
    const meta = await sharp(datos).metadata();
    const w = meta.width ?? maxAncho;
    const h = meta.height ?? maxAlto;
    const escala = Math.min(maxAncho / w, maxAlto / h);
    return new ImageRun({
      type: 'jpg',
      data: datos,
      transformation: { width: Math.round(w * escala), height: Math.round(h * escala) },
    });
  }
}
