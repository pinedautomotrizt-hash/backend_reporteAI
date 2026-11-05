/**
 * Falla de un sistema externo (Control de Personal, Gemini...).
 * Se traduce a HTTP 502 indicando qué servicio no respondió.
 */
export class ServicioExternoError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly servicio = 'Control de Personal',
  ) {
    super(message);
    this.name = 'ServicioExternoError';
  }
}
