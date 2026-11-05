# Backend — Reportes técnicos con IA (Pineda Automotriz)

API para que los técnicos suban fotos de las OT, el jefe de taller las revise y se genere el **informe técnico en Word** redactado con IA (Google Gemini).

Node.js + TypeScript + Fastify · MySQL · Arquitectura hexagonal.

## Arquitectura

```
src/
├── domain/          ← Reglas del negocio (sin frameworks): Reporte, InformeTecnico, Placa, Usuario
├── application/
│   ├── ports/       ← Interfaces: ReporteRepository, AlmacenamientoArchivos, RedactorInforme, ...
│   └── use-cases/   ← Acciones: CrearReporte, EditarReporte, RevisarReporte, GestionarInforme, ...
├── infrastructure/  ← Adaptadores concretos
│   ├── http/        ← Rutas Fastify, autenticación
│   ├── persistence/ ← MySQL (repositorios + migraciones)
│   ├── storage/     ← Fotos en disco (Volume de Railway)
│   ├── external/    ← Control de Personal (usuarios y OTs)
│   ├── ia/          ← Gemini (con respaldo "sin IA")
│   ├── documentos/  ← Generador de Word (.docx)
│   └── imagenes/    ← Compresión de fotos (sharp)
└── main.ts          ← Composition root: conecta adaptadores con casos de uso
```

Para cambiar una tecnología (ej. fotos a Cloudflare R2) se escribe otro adaptador del puerto y se cambia **una línea** en `main.ts`.

## Desarrollo local

```bash
cp .env.example .env    # completar valores
npm install
npm run dev             # http://localhost:4000  (las tablas se crean solas)
```

## Despliegue en Railway

1. **Nuevo proyecto** → *Deploy from GitHub repo* → este repositorio.
2. **Agregar MySQL**: *+ New → Database → MySQL*.
3. **Agregar un Volume** al servicio del backend (*Settings → Volumes*), montado en `/data`.
4. **Variables** del servicio del backend:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` |
| `STORAGE_DIR` | `/data/uploads` |
| `FRONTEND_URL` | URL pública del frontend (varias separadas por coma) |
| `JWT_SECRET` | Texto aleatorio largo y **distinto** al de desarrollo |
| `CONTROL_PERSONAL_URL` | `https://controlpersonalback-production.up.railway.app` |
| `CONTROL_PERSONAL_EMAIL` / `_PASSWORD` | Cuenta de servicio (recomendado: usuario solo para esta integración) |
| `ROLES_JEFE` | Roles de Control de Personal que entran como jefe (ej. `admin`) |
| `GEMINI_API_KEY` | Clave de Google AI Studio |
| `INFORME_JEFE_NOMBRE` / `_CARGO` / `INFORME_RESPONSABLE` | Firma del informe |

`PORT` lo pone Railway automáticamente. Generar `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

5. *Settings → Networking → Generate Domain* para obtener la URL pública.

`railway.json` ya define build (`npm run build`), arranque (`npm start`) y el health check (`/health`).
Las migraciones de `migrations/*.sql` se aplican solas al arrancar.

## Endpoints principales

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/auth/login` | todos (usuario de Control de Personal) |
| GET | `/api/ordenes-trabajo?busqueda=` | técnico (sus OT) / jefe (todas) |
| POST | `/api/reportes` · `/api/reportes/:id/fotos` · `/api/reportes/:id/enviar` | técnico |
| GET | `/api/reportes?estado=&placa=` | técnico (los suyos) / jefe (todos) |
| POST | `/api/reportes/:id/aprobar` · `/observar` | jefe |
| POST | `/api/reportes/:id/informe/generar` | jefe (IA) |
| GET | `/api/reportes/:id/informe/word` | jefe (descarga .docx) |
