-- Reportes técnicos: lo que el técnico envía al jefe con fotos de una OT.
-- Los datos de la OT se copian (snapshot) para que el historial no cambie.
CREATE TABLE reportes (
  id              CHAR(36)      NOT NULL PRIMARY KEY,
  estado          ENUM('BORRADOR','ENVIADO','OBSERVADO','APROBADO') NOT NULL,

  ot_id           INT           NOT NULL,
  nro_orden       VARCHAR(30)   NOT NULL,
  placa           VARCHAR(15)   NOT NULL,
  vehiculo        VARCHAR(200)  NOT NULL,
  vin             VARCHAR(40)   NULL,
  anio            SMALLINT      NULL,
  kilometraje     INT           NULL,
  servicio        VARCHAR(200)  NULL,
  cliente_nombre  VARCHAR(200)  NOT NULL,

  tecnico_id      INT           NOT NULL,
  tecnico_nombre  VARCHAR(150)  NOT NULL,
  usuario_id      INT           NOT NULL,   -- quién lo creó (usuario de Control de Personal)

  requerimiento   TEXT          NOT NULL,
  creado_en       DATETIME(3)   NOT NULL,
  actualizado_en  DATETIME(3)   NOT NULL,
  enviado_en      DATETIME(3)   NULL,

  INDEX ix_reportes_estado (estado, actualizado_en),
  INDEX ix_reportes_placa (placa),
  INDEX ix_reportes_usuario (usuario_id, actualizado_en),
  INDEX ix_reportes_tecnico (tecnico_id),
  INDEX ix_reportes_ot (ot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reporte_fotos (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  reporte_id       CHAR(36)      NOT NULL,
  clave            VARCHAR(300)  NOT NULL,   -- ubicación en el almacenamiento
  clave_miniatura  VARCHAR(300)  NOT NULL,
  descripcion      VARCHAR(1000) NOT NULL DEFAULT '',
  orden            INT           NOT NULL,
  bytes            INT           NOT NULL,
  creada_en        DATETIME(3)   NOT NULL,
  INDEX ix_fotos_reporte (reporte_id, orden),
  CONSTRAINT fk_fotos_reporte FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trazabilidad: cada cambio de estado (quién, cuándo, comentario del jefe)
CREATE TABLE reporte_historial (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  reporte_id       CHAR(36)      NOT NULL,
  estado_anterior  ENUM('BORRADOR','ENVIADO','OBSERVADO','APROBADO') NULL,
  estado_nuevo     ENUM('BORRADOR','ENVIADO','OBSERVADO','APROBADO') NOT NULL,
  usuario_id       INT           NOT NULL,
  usuario_nombre   VARCHAR(150)  NOT NULL,
  comentario       TEXT          NULL,
  fecha            DATETIME(3)   NOT NULL,
  INDEX ix_historial_reporte (reporte_id, fecha),
  CONSTRAINT fk_historial_reporte FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
