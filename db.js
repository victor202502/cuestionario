// db.js
const { Pool } = require('pg');

// Crear un pool de conexiones. El pool manejará las conexiones eficientemente.
// Usará automáticamente la variable de entorno DATABASE_URL si está presente.
// Necesitamos configurar SSL para conexiones a bases de datos en la nube como Render.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Render establece esta variable automáticamente si usas la integración
  ssl: {
    rejectUnauthorized: false // Necesario para conexiones a Render DB en muchos casos (consulta la doc de Render si tienes problemas)
  }
});

// Exportar una función para hacer consultas, para centralizar el manejo de errores o logging si es necesario
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // Exportar el pool directamente si necesitas transacciones más complejas
};