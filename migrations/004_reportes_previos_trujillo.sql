-- Los reportes creados antes de tener varias sedes son todos de Trujillo
-- (Callao aún no usaba la app). Sin esto quedarían con local_id NULL y el
-- jefe técnico de Trujillo dejaría de ver su historial (solo el admin los vería).
UPDATE reportes
   SET local_id = 1, local_nombre = 'Pineda Trujillo'
 WHERE local_id IS NULL;
