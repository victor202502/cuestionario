// db.js
require('dotenv').config(); // Cargar variables de entorno desde .env
const { Pool } = require('pg');

console.log('Attempting to configure database pool...');
// Verifica si la variable DATABASE_URL está cargada desde el entorno
if (!process.env.DATABASE_URL) {
  console.error('!!! FATAL: DATABASE_URL environment variable is not set. Cannot configure database pool. !!!');
  // En un entorno real, podrías querer salir si la URL no está definida
  // process.exit(1);
} else {
   // Opcional: Mostrar una parte de la URL para confirmar (¡SIN la contraseña!)
   try {
        const urlParts = new URL(process.env.DATABASE_URL);
        console.log(`Database URL loaded (Host: ${urlParts.hostname}, Port: ${urlParts.port}, DB: ${urlParts.pathname}, User: ${urlParts.username})`);
   } catch (e) {
        console.warn('Could not parse DATABASE_URL to display parts, might be invalid format.');
   }
}


// --- IMPORTANTE: USA LAS CREDENCIALES DEL POOLER QUE FUNCIONARON ---
// La connectionString debe contener la URL completa del pooler con la contraseña codificada si es necesario

const pool = new Pool({
  // Usar la URL completa es más fácil y preferido, la toma de process.env.DATABASE_URL
  connectionString: process.env.DATABASE_URL,

  // --- Configuración SSL ---
  // Necesario para conexiones seguras, especialmente con Supabase/Cloud providers
  ssl: {
    // **AÑADIDO:** Permite conexiones incluso si la cadena de certificados no puede
    // ser completamente verificada por el entorno (común en PaaS como Render/Heroku).
    // ADVERTENCIA: Reduce la seguridad. Usar solo con hosts de confianza (como Supabase).
    rejectUnauthorized: false
  }
});

// --- Evento para errores en clientes inactivos del pool ---
// Captura errores que ocurren después de que un cliente ha sido usado y devuelto al pool
pool.on('error', (err, client) => {
  console.error('!!! Unexpected error on idle client in database pool !!!', err);
  // Considera estrategias más robustas que salir, pero salir es una opción segura si no se maneja
  process.exit(-1);
});

// --- Prueba de Conexión Inicial ---
// Intenta obtener un cliente del pool al iniciar la aplicación para verificar la conexión
console.log('Attempting initial database connection test...');
pool.connect((err, client, release) => {
  // Manejar error de conexión inicial
  if (err) {
    console.error('!!! Initial Database Connection Failed !!!');
    console.error('Error Code:', err.code); // Código de error específico (ej. 'ECONNREFUSED', 'ENOTFOUND')
    console.error('Error Message:', err.message); // Mensaje legible del error
    console.error('Stack Trace:', err.stack); // Pila de llamadas para depuración avanzada
    // En un entorno de producción, podrías querer reintentar o salir si la BD es esencial
    // process.exit(1);
    console.log("Database pool configuration finished (with initial connection error).");
    return; // No continuar si la conexión inicial falla
  }

  // Si la conexión fue exitosa
  console.log('>>> Initial Database Connection Successful! Pool acquired a client. <<<');

  // Ejecutar una consulta simple para confirmar que la comunicación funciona
  client.query('SELECT NOW() AS current_time', (err, result) => {
    release(); // ¡MUY IMPORTANTE! Liberar el cliente de vuelta al pool cuando termines

    if (err) {
      console.error('!!! Error executing initial test query after connection !!!');
      console.error('Error Code:', err.code);
      console.error('Error Message:', err.message);
      console.error('Stack Trace:', err.stack);
      console.log("Database pool configuration finished (with test query error).");
      return;
    }

    // Si la consulta de prueba fue exitosa
    console.log('>>> Test query successful. Current DB time:', result.rows[0].current_time);
    console.log("Database pool configuration finished successfully.");
  });
});

// Exporta el objeto con el método query para ser usado por el resto de la aplicación
module.exports = {
  query: (text, params) => pool.query(text, params),
  // Opcional: exportar el pool directamente si necesitas más control o el método getClient
  // pool: pool,
  // getClient: () => pool.connect(),
};

// Nota: Los logs de "configuration finished" ahora se imprimen dentro de la callback de pool.connect
// para reflejar si la conexión inicial y la consulta de prueba tuvieron éxito o no.