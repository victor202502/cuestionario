// init-db.js
require('dotenv').config(); // Carga .env si lo usas para desarrollo local
const { Pool } = require('pg');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    quiz_state JSONB DEFAULT '{}'::jsonb
);
`;

// Crea un pool temporal SOLO para este script
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // ¡Necesitas DATABASE_URL definida localmente o en Render para que esto funcione!
    ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
    console.log("Attempting to connect to database to set up schema...");
    const client = await pool.connect();
    console.log("Connected! Running CREATE TABLE command...");
    try {
        await client.query(createTableQuery);
        console.log("SUCCESS: 'users' table checked/created successfully.");
    } catch (err) {
        console.error("ERROR creating table:", err);
    } finally {
        client.release(); // Libera el cliente de vuelta al pool
        await pool.end(); // Cierra el pool ya que terminamos
        console.log("Database setup script finished.");
    }
}

// Ejecutar la función
setupDatabase();