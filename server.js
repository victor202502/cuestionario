// server.js (MODIFICADO)
const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path'); // Necesitamos 'path'
const cors = require('cors');

const app = express();
const port = 3000;

// --- Middlewares ---
app.use(cors()); // Mantenemos CORS por si acaso (no estrictamente necesario si todo es mismo origen, pero no daña)
app.use(express.json()); // Para parsear cuerpos JSON de API requests

// --- ¡NUEVO: Servir archivos estáticos desde la carpeta 'public'! ---
// Esto debe ir ANTES de tus rutas de API
app.use(express.static(path.join(__dirname, 'public')));

// --- Basic File Storage ---
const DB_FILE = path.join(__dirname, 'users.json');

// --- Funciones getUsers & saveUsers (SIN CAMBIOS) ---
function getUsers() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      if (data.trim() === '') return [];
      try {
          const users = JSON.parse(data);
           if (!Array.isArray(users)) {
               console.error(`Data in ${DB_FILE} is not a JSON array. Returning empty array.`);
               return [];
           }
           return users;
      } catch (parseError) {
          console.error(`Error parsing JSON from ${DB_FILE}:`, parseError.message);
          return [];
      }
    }
  } catch (err) {
    console.error(`Error reading the user 'database' file (${DB_FILE}):`, err);
  }
  return [];
}

function saveUsers(users) {
  try {
    if (!Array.isArray(users)) return false;
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log(`Users data saved successfully to ${DB_FILE}`);
    return true;
  } catch (err) {
    console.error(`Error writing to the user 'database' file (${DB_FILE}):`, err);
    return false;
  }
}


// --- RUTAS DE LA API (SIN CAMBIOS EN SU LÓGICA INTERNA) ---
// Ahora serán accedidas vía http://localhost:3000/register, http://localhost:3000/login, etc.

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ message: 'Valid username and password (min 6 chars) required.' });
  }
  const users = getUsers();
  if (users.find(user => user.username === username)) {
    return res.status(409).json({ message: 'El nombre de usuario ya existe' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(), username, password: hashedPassword,
      quizState: { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null }
    };
    users.push(newUser);
    if (saveUsers(users)) res.status(201).json({ message: 'Usuario registrado exitosamente' });
    else res.status(500).json({ message: 'Error interno del servidor al guardar usuario' });
  } catch (error) {
    console.error("/register Error:", error); res.status(500).json({ message: 'Error interno del servidor al registrar' });
  }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos' });
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        // Ensure structure exists
        if (!user.quizState) user.quizState = { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null };
        else if (!user.quizState.submittedAnswersByPage) user.quizState.submittedAnswersByPage = {};
        res.status(200).json({ message: 'Login exitoso', username: user.username });
    } catch (error) {
        console.error(`/login Error for "${username}":`, error); res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/save-quiz-state', (req, res) => {
    console.log('Received request on /api/save-quiz-state.');
    const { username, score, mistakes, currentSection, currentIndex, lastSubmittedAnswers, clearAllAnswers, clearCurrentPageAnswers, resetScoreAndMistakesOnly } = req.body;

    // Validación (sin cambios)
    if (!username || typeof currentSection !== 'number' || typeof currentIndex !== 'number') {
         console.log('/api/save-quiz-state: Validation failed - Missing username or location.');
         return res.status(400).json({ message: 'Usuario, sección e índice son requeridos.' });
    }
     if (!resetScoreAndMistakesOnly && (typeof score !== 'number' || typeof mistakes !== 'number')) {
         console.log('/api/save-quiz-state: Validation failed - Missing or invalid score/mistakes.');
         return res.status(400).json({ message: 'Datos de puntuación inválidos.' });
     }

    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) return res.status(404).json({ message: `Usuario '${username}' no encontrado.` });

    try {
        const user = users[userIndex];
        if (!user.quizState) user.quizState = { submittedAnswersByPage: {} };
        if (!user.quizState.submittedAnswersByPage) user.quizState.submittedAnswersByPage = {};

        user.quizState.currentSection = currentSection;
        user.quizState.currentIndex = currentIndex;
        user.quizState.lastSaved = new Date().toISOString();

        if (resetScoreAndMistakesOnly === true) {
            console.log(`Resetting score/mistakes ONLY for user ${username}.`);
            user.quizState.score = 0;
            user.quizState.mistakes = 0;
        } else {
             user.quizState.score = score;
             user.quizState.mistakes = mistakes;
        }

        if (clearAllAnswers === true) {
            console.log(`Clearing ALL submitted answers for user ${username}.`);
            user.quizState.submittedAnswersByPage = {};
        }
        else if (clearCurrentPageAnswers === true) {
            const pageKeyToClear = `${currentSection}-${currentIndex}`;
            if (user.quizState.submittedAnswersByPage[pageKeyToClear]) {
                console.log(`Clearing answers for current page key: ${pageKeyToClear} for user ${username}.`);
                delete user.quizState.submittedAnswersByPage[pageKeyToClear];
            } else {
                console.log(`No answers found for page key ${pageKeyToClear} to clear for user ${username}.`);
            }
        }
        else if (lastSubmittedAnswers !== null && lastSubmittedAnswers !== undefined) {
            const pageKeyToAdd = `${currentSection}-${currentIndex}`;
            console.log(`Saving answers for page key: ${pageKeyToAdd} for user ${username}`);
            user.quizState.submittedAnswersByPage[pageKeyToAdd] = lastSubmittedAnswers;
        }

        if (saveUsers(users)) {
            res.status(200).json({ message: 'Estado del quiz guardado exitosamente.' });
        } else {
             res.status(500).json({ message: 'Error interno del servidor al guardar el estado.' });
        }
    } catch (error) {
         console.error(`/api/save-quiz-state Error for "${username}":`, error);
         res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.get('/api/get-quiz-state', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Nombre de usuario es requerido.' });
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ message: `Usuario '${username}' no encontrado.` });
    if (user.quizState) {
         if (!user.quizState.submittedAnswersByPage) user.quizState.submittedAnswersByPage = {};
        res.status(200).json(user.quizState);
    } else {
        // Devuelve un estado inicial si no existe, en lugar de 404
        // Esto simplifica la lógica del cliente en loadQuizStateFromBackend
         console.log(`No saved state found for '${username}'. Returning default initial state.`);
         res.status(200).json({
             score: 0,
             mistakes: 0,
             currentSection: 1,
             currentIndex: 1,
             submittedAnswersByPage: {},
             lastSaved: null
         });
        // Alternativa (comportamiento anterior):
        // return res.status(404).json({ message: `No hay estado guardado para '${username}'.` });
    }
});


// --- Start Server ---
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  // Asegurarse que el archivo de usuarios existe al iniciar
  if (!fs.existsSync(DB_FILE)) {
      console.log(`Users file (${DB_FILE}) not found. Creating empty file.`);
      saveUsers([]);
  } else {
      console.log(`Users file (${DB_FILE}) found.`);
  }
});