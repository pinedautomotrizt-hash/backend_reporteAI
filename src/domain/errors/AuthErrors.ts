import { DomainError } from './DomainError.js';

/** Email o contraseña incorrectos (HTTP 401). */
export class CredencialesInvalidasError extends DomainError {
  constructor(message = 'Email o contraseña incorrectos') {
    super(message);
    this.name = 'CredencialesInvalidasError';
  }
}

/** Sesión válida pero sin permiso para la acción (HTTP 403). */
export class AccesoDenegadoError extends DomainError {
  constructor(message = 'No tienes permiso para esta acción') {
    super(message);
    this.name = 'AccesoDenegadoError';
  }
}
