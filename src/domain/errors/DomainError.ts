/**
 * Error de regla de negocio.
 * Vive en el dominio: no sabe nada de HTTP. La capa de infraestructura
 * decide cómo traducirlo (por ejemplo, a un 400 Bad Request).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
