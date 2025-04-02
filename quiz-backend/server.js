// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs'); // Para guardar en archivo (¡muy básico!)
const cors = require('cors'); // Para permitir comunicación frontend <-> backend

const app = express();
const port = 3000; // Puerto donde correrá el backend

// --- Middlewares ---
// These should appear only ONCE, before routes
app.use(cors()); // Habilita CORS para todas las rutas
app.use(express.json()); // Permite al servidor entender datos JSON enviados desde el frontend

// --- Almacenamiento MUY BÁSICO (en un archivo JSON) ---
// ¡¡¡NO RECOMENDADO PARA PRODUCCIÓN!!! Usa una base de datos real.
const DB_FILE = './users.json';

// Función para leer usuarios del archivo
function getUsers() {
  try {
    // Check if file exists synchronously
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8'); // Specify encoding
      // Prevent parsing empty file
      if (data.trim() === '') {
          return [];
      }
      return JSON.parse(data);
    }
  } catch (err) {
    // Handle specific errors like JSON parsing errors
    if (err instanceof SyntaxError) {
        console.error("Error parsing JSON from users file:", err.message);
        // Decide how to handle: return empty array, or throw/log differently
        // For simplicity, returning empty might prevent crashes but hides data corruption
        return [];
    } else {
        console.error("Error reading the user 'database' file:", err);
    }
  }
  // Return empty array if file doesn't exist or on other errors
  return [];
}

// Función para guardar usuarios en el archivo
function saveUsers(users) {
  try {
    // Ensure users is an array before stringifying
    if (!Array.isArray(users)) {
        console.error("Attempted to save non-array data to users file.");
        return; // Or throw an error
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8'); // Specify encoding
    console.log(`Users saved to ${DB_FILE}`); // Confirmation log
  } catch (err) {
    console.error("Error writing to the user 'database' file:", err);
  }
}

// --- Rutas (Endpoints) ---

// Ruta para registrar un nuevo usuario (usaremos POST)
// This should appear only ONCE
app.post('/register', async (req, res) => {
  console.log('Received request on /register. Body:', req.body);
  const { username, password } = req.body;

  // Simple Validation
  if (!username || !password) {
    console.log('/register: Validation failed - Missing username or password.');
    return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos' });
  }
  // Add password length validation (example)
  if (password.length < 6) {
    console.log('/register: Validation failed - Password too short.');
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }


  const users = getUsers();
  console.log(`/register: Found ${users.length} existing users.`);

  // Check if user already exists
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    console.log(`/register: Username "${username}" already exists.`);
    return res.status(409).json({ message: 'El nombre de usuario ya existe' }); // 409 Conflict
  }

  try {
    console.log(`/register: Hashing password for "${username}"...`);
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log(`/register: Password hashed successfully.`);

    const newUser = {
      id: Date.now().toString(), // Simple unique ID example
      username: username,
      password: hashedPassword
    };

    users.push(newUser);
    saveUsers(users); // Attempt to save

    console.log(`/register: User "${username}" registered successfully.`);
    res.status(201).json({ message: 'Usuario registrado exitosamente' }); // 201 Created

  } catch (error) {
    console.error("/register: Error during hashing or saving:", error);
    res.status(500).json({ message: 'Error interno del servidor al registrar' });
  }
});


// --- Ruta para INICIAR SESIÓN (usaremos POST) ---
// This should appear only ONCE
app.post('/login', async (req, res) => {
  console.log('Received request on /login. Body:', req.body);
  const { username, password } = req.body;

  // Simple Validation
  if (!username || !password) {
    console.log('/login: Validation failed - Missing username or password.');
    return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos' });
  }

  const users = getUsers();
  console.log(`/login: Found ${users.length} existing users.`);

  // Find user by username
  const user = users.find(u => u.username === username);

  if (!user) {
    console.log(`/login: Login failed - User "${username}" not found.`);
    // Generic message for security
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos' }); // 401 Unauthorized
  }

  console.log(`/login: User "${username}" found. Comparing password...`);
  try {
    // Compare submitted password with stored hash
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log(`/login: Login failed - Incorrect password for user "${username}".`);
      // Generic message
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    // Login Successful!
    console.log(`/login: Login successful for user "${username}".`);
    // Send success response WITH username for the frontend
    res.status(200).json({ message: 'Login exitoso', username: user.username });

  } catch (error) {
    console.error(`/login: Error during password comparison for "${username}":`, error);
    res.status(500).json({ message: 'Error interno del servidor durante el login' });
  }
});


// --- Iniciar el servidor ---
// app.listen(...) should be at the end and only ONCE
app.listen(port, () => {
  console.log(`Servidor backend escuchando en http://localhost:${port}`);
  // Check if users file exists on startup, create if not
  if (!fs.existsSync(DB_FILE)) {
      console.log(`Users file (${DB_FILE}) not found, creating an empty one.`);
      saveUsers([]); // Create file with empty array
  }
});