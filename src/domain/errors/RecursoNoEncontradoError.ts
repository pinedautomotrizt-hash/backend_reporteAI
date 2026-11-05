import { DomainError } from './DomainError.js';

/** Algo que se buscó no existe (se traduce a HTTP 404). */
export class RecursoNoEncontradoError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'RecursoNoEncontradoError';
  }
}
