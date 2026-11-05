import mysql from 'mysql2/promise';

/**
 * Pool de conexiones MySQL. Un "pool" reutiliza conexiones abiertas en lugar
 * de abrir una nueva por cada petición (más rápido y no satura el servidor).
 *
 * En Railway la URL la da el plugin de MySQL:  DATABASE_URL=${{MySQL.MYSQL_URL}}
 */
export function crearPool(url: string) {
  return mysql.createPool({
    uri: url,
    connectionLimit: 10,
    timezone: 'Z', // guardar y leer fechas en UTC
    dateStrings: false,
    supportBigNumbers: true,
  });
}

export type Pool = ReturnType<typeof crearPool>;
