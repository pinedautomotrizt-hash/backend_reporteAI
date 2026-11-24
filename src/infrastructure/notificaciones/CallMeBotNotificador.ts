import type { Notificador } from '../../application/ports/Notificador.js';

/**
 * ADAPTADOR: envía WhatsApp con CallMeBot (gratis, uso personal).
 * Solo puede escribir al número que activó el bot y obtuvo la APIKEY.
 * Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
export class CallMeBotNotificador implements Notificador {
  constructor(
    private readonly cfg: { telefono: string; apiKey: string; timeoutSegundos?: number },
  ) {}

  async notificar(mensaje: string): Promise<void> {
    const url = new URL('https://api.callmebot.com/whatsapp.php');
    url.searchParams.set('phone', this.cfg.telefono);
    url.searchParams.set('text', mensaje);
    url.searchParams.set('apikey', this.cfg.apiKey);

    const res = await fetch(url, { signal: AbortSignal.timeout((this.cfg.timeoutSegundos ?? 15) * 1000) });
    const cuerpo = await res.text();
    // CallMeBot a veces responde 200 con un error en el texto
    if (!res.ok || /error|invalid|not\s+allowed/i.test(cuerpo)) {
      throw new Error(`CallMeBot respondió ${res.status}: ${cuerpo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    }
  }
}

/** Sin configuración: no avisa a nadie. */
export class SinNotificador implements Notificador {
  async notificar(): Promise<void> {}
}
