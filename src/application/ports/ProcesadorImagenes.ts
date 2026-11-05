/**
 * PUERTO DE SALIDA: preparar una foto para guardarla.
 * El adaptador debe: validar que sea imagen, corregir la rotación del
 * celular, reducir el tamaño y generar una miniatura para las listas.
 */
export interface ImagenProcesada {
  principal: { datos: Buffer; tipo: string; extension: string };
  miniatura: { datos: Buffer; tipo: string; extension: string };
}

export interface ProcesadorImagenes {
  procesar(original: Buffer): Promise<ImagenProcesada>;
}
