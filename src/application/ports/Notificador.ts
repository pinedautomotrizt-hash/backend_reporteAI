/**
 * PUERTO DE SALIDA: "avisa a alguien que pasó algo".
 * Hoy: WhatsApp con CallMeBot. Mañana podría ser Telegram, correo o la API de Meta
 * sin tocar los casos de uso.
 *
 * Regla: un aviso que falla NUNCA debe hacer fallar la operación principal.
 */
export interface Notificador {
  notificar(mensaje: string): Promise<void>;
}
