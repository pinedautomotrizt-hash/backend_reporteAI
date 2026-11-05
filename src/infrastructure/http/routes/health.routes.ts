import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  // Railway usa esta ruta para saber si el servidor está vivo (ver railway.json)
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
}
