import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { RecursoNoEncontradoError } from '../../domain/errors/RecursoNoEncontradoError.js';
import { AccesoDenegadoError, CredencialesInvalidasError } from '../../domain/errors/AuthErrors.js';
import { ServicioExternoError } from '../errors/ServicioExternoError.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes, type AuthDeps } from './routes/auth.routes.js';
import { ordenesTrabajoRoutes, type OrdenesTrabajoDeps } from './routes/ordenes-trabajo.routes.js';
import { reportesRoutes, type ReportesDeps } from './routes/reportes.routes.js';
import { archivosRoutes } from './routes/archivos.routes.js';
import { informesRoutes, type InformesDeps } from './routes/informes.routes.js';
import type { DiscoLocalAlmacenamiento } from '../storage/DiscoLocalAlmacenamiento.js';
import { MAX_BYTES_FOTO } from '../../application/use-cases/reportes/EditarReporte.js';

export type ServidorDeps = AuthDeps &
  OrdenesTrabajoDeps &
  ReportesDeps &
  InformesDeps & {
    /** Solo si las fotos se guardan en disco local (sirve los archivos). */
    almacenamientoLocal?: DiscoLocalAlmacenamiento;
  };

/**
 * Adaptador HTTP (puerto de entrada).
 * Recibe los casos de uso ya construidos (no los crea él) y traduce
 * los errores de las capas internas a códigos HTTP.
 */
export async function crearServidor(deps: ServidorDeps) {
  const app = Fastify({ logger: true, trustProxy: true }); // trustProxy: Railway pone un proxy delante

  await app.register(cors, { origin: env.FRONTEND_URL, credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], exposedHeaders: ['Content-Disposition'] });
  // Subida de fotos: 1 archivo por petición, máx. 15 MB
  await app.register(multipart, { limits: { fileSize: MAX_BYTES_FOTO, files: 1, fields: 5 } });
  // global: false -> solo se limita donde la ruta lo pide (login)
  await app.register(rateLimit, { global: false });
  app.decorateRequest('usuario', null);

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof CredencialesInvalidasError) return reply.status(401).send({ error: error.message });
    if (error instanceof AccesoDenegadoError) return reply.status(403).send({ error: error.message });
    if (error instanceof RecursoNoEncontradoError) return reply.status(404).send({ error: error.message });
    if (error instanceof DomainError) return reply.status(400).send({ error: error.message });
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message ?? 'Datos inválidos', detalles: error.issues });
    }
    if (error instanceof ServicioExternoError) {
      app.log.error(error);
      return reply.status(502).send({ error: `El servicio ${error.servicio} no está disponible. Intenta nuevamente.` });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.status(status).send({ error: (error as Error).message });
    app.log.error(error);
    return reply.status(500).send({ error: 'Error interno del servidor' });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes(deps));
  await app.register(ordenesTrabajoRoutes(deps));
  await app.register(reportesRoutes(deps));
  await app.register(informesRoutes(deps));
  if (deps.almacenamientoLocal) await app.register(archivosRoutes(deps.almacenamientoLocal));

  return app;
}
