-- Informe técnico generado (con IA) a partir de un reporte.
-- El contenido es JSON: lo edita el jefe antes de descargar el Word.
CREATE TABLE informes (
  reporte_id      CHAR(36)     NOT NULL PRIMARY KEY,
  contenido       JSON         NOT NULL,
  generado_por    VARCHAR(80)  NOT NULL,   -- modelo de IA usado, o "sin-ia"
  creado_en       DATETIME(3)  NOT NULL,
  actualizado_en  DATETIME(3)  NOT NULL,
  CONSTRAINT fk_informes_reporte FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
