// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Basic File Storage ---
const DB_FILE = path.join(__dirname, 'users.json');

// --- getUsers & saveUsers functions (remain the same) ---
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

// --- /register & /login routes (remain the same) ---
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

// --- Save Quiz State ---
app.post('/api/save-quiz-state', (req, res) => {
    console.log('Received request on /api/save-quiz-state.');
    // ** Destructure new flag **
    const { username, score, mistakes, currentSection, currentIndex, lastSubmittedAnswers, clearAllAnswers, clearCurrentPageAnswers, resetScoreAndMistakesOnly } = req.body;

    // Validation
    if (!username || typeof currentSection !== 'number' || typeof currentIndex !== 'number') { // Score/mistakes might be sent as 0 during reset
         console.log('/api/save-quiz-state: Validation failed - Missing username or location.');
         return res.status(400).json({ message: 'Usuario, sección e índice son requeridos.' });
    }
     // Validate score/mistakes only if not explicitly resetting them
     if (!resetScoreAndMistakesOnly && (typeof score !== 'number' || typeof mistakes !== 'number')) {
         console.log('/api/save-quiz-state: Validation failed - Missing or invalid score/mistakes.');
         return res.status(400).json({ message: 'Datos de puntuación inválidos.' });
     }


    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) return res.status(404).json({ message: `Usuario '${username}' no encontrado.` });

    try {
        const user = users[userIndex];
        // Ensure structure
        if (!user.quizState) user.quizState = { submittedAnswersByPage: {} };
        if (!user.quizState.submittedAnswersByPage) user.quizState.submittedAnswersByPage = {};

        // --- Update general state (Location, Timestamp) ---
        // Always update location based on request
        user.quizState.currentSection = currentSection;
        user.quizState.currentIndex = currentIndex;
        user.quizState.lastSaved = new Date().toISOString();

        // --- Handle Score/Mistakes ---
        // If specifically resetting score/mistakes only
        if (resetScoreAndMistakesOnly === true) {
            console.log(`Resetting score/mistakes ONLY for user ${username}.`);
            user.quizState.score = 0;
            user.quizState.mistakes = 0;
        }
        // Otherwise, update score/mistakes from request (covers normal saves and clearAll)
        else {
             // Use score/mistakes from request body (they will be 0 if clearAll was requested from frontend)
             user.quizState.score = score;
             user.quizState.mistakes = mistakes;
        }

        // --- Logic for handling ANSWERS based on flags (Order matters!) ---
        // 1. Check if clearing ALL answers (takes precedence over other answer actions)
        if (clearAllAnswers === true) {
            console.log(`Clearing ALL submitted answers for user ${username}.`);
            user.quizState.submittedAnswersByPage = {};
        }
        // 2. Else IF NOT clearing all, check if clearing only the CURRENT page's answers
        else if (clearCurrentPageAnswers === true) {
            const pageKeyToClear = `${currentSection}-${currentIndex}`;
            if (user.quizState.submittedAnswersByPage[pageKeyToClear]) {
                console.log(`Clearing answers for current page key: ${pageKeyToClear} for user ${username}.`);
                delete user.quizState.submittedAnswersByPage[pageKeyToClear];
            } else {
                console.log(`No answers found for page key ${pageKeyToClear} to clear for user ${username}.`);
            }
        }
        // 3. Else IF NOT clearing anything, check if submitting answers for the CURRENT page
        else if (lastSubmittedAnswers !== null && lastSubmittedAnswers !== undefined) {
            const pageKeyToAdd = `${currentSection}-${currentIndex}`;
            console.log(`Saving answers for page key: ${pageKeyToAdd} for user ${username}`);
            user.quizState.submittedAnswersByPage[pageKeyToAdd] = lastSubmittedAnswers;
        }
        // 4. Else (navigating, or resetScoreOnly=true), leave submittedAnswersByPage as is.


        // Save updated user data
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

// --- Get Quiz State (remains the same) ---
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
        return res.status(404).json({ message: `No hay estado guardado para '${username}'.` });
    }
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Servidor backend escuchando en http://localhost:${port}`);
  if (!fs.existsSync(DB_FILE)) saveUsers([]);
  else console.log(`Users file (${DB_FILE}) found.`);
});