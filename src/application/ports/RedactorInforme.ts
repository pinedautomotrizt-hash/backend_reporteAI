/**
 * PUERTO DE SALIDA: "redacta el texto técnico del informe".
 * Hoy: Google Gemini (el mismo que usa Control de Personal).
 * Si no hay clave de IA, se usa un redactor simple que copia lo del técnico.
 */
export interface EntradaRedaccion {
  vehiculo: string; // "MITSUBISHI L200 8502 MODERNO 2024"
  kilometraje: number | null;
  servicio: string | null; // "MANTENIMIENTO 135,000 KM"
  tipoOt: string | null; // "MANTENIMIENTO PERIODICO"
  requerimientoTecnico: string;
  actividadesOT: string[]; // servicios y repuestos de la OT
  fotos: { numero: number; descripcionTecnico: string; imagen: Buffer; tipo: string }[];
}

export interface Redaccion {
  motivo: string;
  tituloFotoPrincipal: string;
  condicion: string;
  diagnosticoIntro: string;
  observaciones: string[];
  conclusion: string;
  recomendaciones: string[];
  leyendas: { numero: number; leyenda: string }[];
  modelo: string; // qué modelo de IA lo hizo
}

export interface RedactorInforme {
  redactar(entrada: EntradaRedaccion): Promise<Redaccion>;
}
