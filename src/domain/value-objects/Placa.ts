import { DomainError } from '../errors/DomainError.js';

/**
 * Value Object "Placa".
 * Garantiza que en todo el sistema una placa siempre esté normalizada
 * (mayúsculas, con guion) y sea válida. Si existe un objeto Placa, es válido.
 *
 * Formato Perú: 3 caracteres alfanuméricos + 3 dígitos  (ABC-123, A1B-234).
 * Si el formato cambia, solo se modifica este archivo.
 */
export class Placa {
  private static readonly FORMATO = /^[A-Z0-9]{3}-?\d{3}$/;

  private constructor(public readonly valor: string) {}

  static crear(entrada: string): Placa {
    const limpia = entrada.trim().toUpperCase().replace(/\s+/g, '');
    if (!Placa.FORMATO.test(limpia)) {
      throw new DomainError(`Placa inválida: "${entrada}". Formato esperado: ABC-123`);
    }
    const normalizada = limpia.includes('-') ? limpia : `${limpia.slice(0, 3)}-${limpia.slice(3)}`;
    return new Placa(normalizada);
  }

  equals(otra: Placa): boolean {
    return this.valor === otra.valor;
  }

  toString(): string {
    return this.valor;
  }
}
