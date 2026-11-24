-- Varias sedes (Trujillo, Callao...): cada reporte guarda la sede de su OT
-- para que el jefe técnico de una sede solo vea los reportes de la suya.
-- Los reportes anteriores quedan con NULL: solo los ve el admin (todas las sedes).
ALTER TABLE reportes
  ADD COLUMN local_id     INT          NULL AFTER cliente_nombre,
  ADD COLUMN local_nombre VARCHAR(150) NULL AFTER local_id,
  ADD INDEX ix_reportes_local (local_id, estado);
