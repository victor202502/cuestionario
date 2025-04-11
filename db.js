// db.js
require('dotenv').config(); // Cargar variables de entorno desde .env
const { Pool } = require('pg');

// --- IMPORTANTE: USA LAS CREDENCIALES DEL POOLER QUE FUNCIONARON ---
//     (las que empiezan con aws-0-... y usan el puerto 5432 o 6543 y el usuario con el punto)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Usar la URL completa es más fácil
  // O puedes configurar las partes individualmente:
  // user: process.env.DB_USER,          // ej: postgres.hynnqrwcgztdhefewnfe
  // host: process.env.DB_HOST,          // ej: aws-0-eu-central-1.pooler.supabase.com
  // database: process.env.DB_DATABASE,    // ej: postgres
  // password: process.env.DB_PASSWORD,    // ej: h?nxb@xAFC8x_Y.
  // port: parseInt(process.env.DB_PORT || '5432', 10), // Puerto del Pooler (5432 o 6543)
  ssl: {
    // Supabase requiere SSL, pero el pooler puede manejarlo de forma diferente.
    // Prueba primero sin 'rejectUnauthorized: false'. Si falla, añádelo.
    // Si estás en un entorno como Render/Heroku, a menudo no necesitas especificarlo.
    // rejectUnauthorized: false // ¡SOLO si es estrictamente necesario y entiendes los riesgos!
  }
});

// Evento para errores de conexión en el pool (opcional pero útil)
pool.on('error', (err, client) => {
  console.error('Error inesperado en cliente inactivo del pool', err);
  process.exit(-1); // Salir si hay un error grave de conexión
});

// Exporta un objeto con un método query para usar el pool
module.exports = {
  query: (text, params) => pool.query(text, params),
  // Opcional: método para obtener un cliente directamente si necesitas transacciones
  // getClient: () => pool.connect(),
};

console.log("Database pool configured using environment variables.");
// Opcional: Hacer una consulta simple al iniciar para verificar la conexión
// pool.query('SELECT NOW()', (err, res) => {
//   if (err) {
//     console.error('Database connection test failed:', err.stack);
//   } else {
//     console.log('Database connection test successful:', res.rows[0]);
//   }
// });