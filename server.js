// server.js (CORREGIDO PARA USAR POSTGRESQL)

require('dotenv').config(); // Carga .env si existe (para desarrollo local)
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
const db = require('./db'); // Importar el módulo de conexión a la BD

const app = express();
// Usar el puerto proporcionado por Render o 3000 localmente
const port = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json()); // Para parsear cuerpos JSON de API requests

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- ¡SE ELIMINAN LAS FUNCIONES getUsers/saveUsers/DB_FILE! ---
// --- Se reemplazan con funciones que interactúan con la BD ---

// --- Funciones de Base de Datos ---

async function findUserByUsername(username) {
  const queryText = 'SELECT * FROM users WHERE username = $1';
  try {
    const result = await db.query(queryText, [username]);
    return result.rows[0]; // Devuelve el usuario encontrado o undefined
  } catch (err) {
    console.error('Error finding user by username:', err);
    throw err;
  }
}

async function createUser(username, hashedPassword) {
  const queryText = `
    INSERT INTO users (username, password, quiz_state)
    VALUES ($1, $2, DEFAULT)
    RETURNING id, username, quiz_state`; // 'DEFAULT' usará '{}'::jsonb definido en la tabla
  try {
    // El quiz_state se inicializa con el DEFAULT de la tabla
    const result = await db.query(queryText, [username, hashedPassword]);
    return result.rows[0];
  } catch (err) {
    console.error('Error creating user:', err);
    // Manejar error si el usuario ya existe (violación de UNIQUE constraint)
    if (err.code === '23505') {
        throw new Error('Username already exists'); // Lanzar error específico
    }
    throw err; // Relanzar otros errores
  }
}

async function getUserQuizState(username) {
  const queryText = 'SELECT quiz_state FROM users WHERE username = $1';
   try {
    const result = await db.query(queryText, [username]);
    if (result.rows.length > 0) {
      // La columna quiz_state tiene un DEFAULT, así que no debería ser null.
      // Pero por seguridad, si es null, devolvemos el objeto por defecto.
      return result.rows[0].quiz_state || { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null };
    } else {
      // Usuario no encontrado
      return null;
    }
  } catch (err) {
    console.error('Error getting user quiz state:', err);
    throw err;
  }
}

async function updateUserQuizState(username, newQuizState) {
  const queryText = 'UPDATE users SET quiz_state = $1 WHERE username = $2 RETURNING username';
   try {
    // El objeto newQuizState se pasará directamente, el driver pg lo convierte a JSONB
    const result = await db.query(queryText, [newQuizState, username]);
     if (result.rowCount === 0) {
       // El usuario no existía para actualizar
       throw new Error('User not found, cannot update quiz state');
     }
     console.log(`Quiz state updated successfully in DB for user: ${username}`);
     return true;
  } catch (err) {
    console.error('Error updating user quiz state:', err);
    throw err;
  }
}

// --- Rutas de API Modificadas para usar la Base de Datos ---

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ message: 'Valid username and password (min 6 chars) required.' });
  }
  try {
    // Verificar si el usuario ya existe en la BD
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      console.log(`Registration failed: Username "${username}" already exists.`);
      return res.status(409).json({ message: 'El nombre de usuario ya existe' });
    }

    // Hashear contraseña y crear usuario en la BD
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser(username, hashedPassword);
    console.log(`User "${username}" registered successfully.`);
    res.status(201).json({ message: 'Usuario registrado exitosamente', username: newUser.username });

  } catch (error) {
     // Capturar el error específico de 'Username already exists' lanzado por createUser
     if (error.message === 'Username already exists') {
        console.log(`Registration failed (duplicate): Username "${username}" already exists.`);
        return res.status(409).json({ message: 'El nombre de usuario ya existe' });
     }
     // Capturar otros errores
     console.error("/register Error:", error);
     res.status(500).json({ message: 'Error interno del servidor al registrar' });
  }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos' });

    try {
        // Buscar usuario en la BD
        const user = await findUserByUsername(username);
        if (!user) {
            console.log(`Login attempt failed: User "${username}" not found.`);
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // Comparar contraseña hasheada
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
             console.log(`Login attempt failed: Incorrect password for user "${username}".`);
             return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // Login exitoso
        console.log(`Login successful for user "${username}".`);
        res.status(200).json({ message: 'Login exitoso', username: user.username });

    } catch (error) {
        console.error(`/login Error for "${username}":`, error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/save-quiz-state', async (req, res) => {
    console.log('Received request on /api/save-quiz-state.');
    const { username, score, mistakes, currentSection, currentIndex, lastSubmittedAnswers, clearAllAnswers, clearCurrentPageAnswers, resetScoreAndMistakesOnly } = req.body;

    // Validación (igual que antes)
    if (!username || typeof currentSection !== 'number' || typeof currentIndex !== 'number') {
         console.log('/api/save-quiz-state: Validation failed - Missing username or location.');
         return res.status(400).json({ message: 'Usuario, sección e índice son requeridos.' });
    }
     if (!resetScoreAndMistakesOnly && (typeof score !== 'number' || typeof mistakes !== 'number')) {
         console.log('/api/save-quiz-state: Validation failed - Missing or invalid score/mistakes.');
         return res.status(400).json({ message: 'Datos de puntuación inválidos.' });
     }

    try {
        // 1. Obtener el estado ACTUAL del quiz desde la BD
        let currentState = await getUserQuizState(username);

        // Verificar si el usuario existe (si currentState es null)
        if (!currentState) {
             console.log(`/api/save-quiz-state: User "${username}" not found when trying to save state.`);
             return res.status(404).json({ message: `Usuario '${username}' no encontrado.` });
        }

        // 2. Construir el NUEVO objeto quizState aplicando los cambios del request
        const newQuizState = {
            // Empezar con el estado actual como base
            ...currentState,
            // Actualizar campos generales según el request
            currentSection: currentSection,
            currentIndex: currentIndex,
            lastSaved: new Date().toISOString(),
            // Actualizar score/mistakes según flags y el request
            score: resetScoreAndMistakesOnly ? 0 : score,
            mistakes: resetScoreAndMistakesOnly ? 0 : mistakes,
            // Empezar con las respuestas actuales, luego modificarlas si es necesario
            submittedAnswersByPage: { ...(currentState.submittedAnswersByPage || {}) } // Asegura que sea un objeto
        };

        // Aplicar lógica para modificar las respuestas guardadas en newQuizState
        if (clearAllAnswers === true) {
            console.log(`Clearing ALL submitted answers for user ${username}.`);
            newQuizState.submittedAnswersByPage = {};
        }
        else if (clearCurrentPageAnswers === true) {
            const pageKeyToClear = `${currentSection}-${currentIndex}`;
            if (newQuizState.submittedAnswersByPage[pageKeyToClear]) {
                console.log(`Clearing answers for current page key: ${pageKeyToClear} for user ${username}.`);
                delete newQuizState.submittedAnswersByPage[pageKeyToClear];
            } else {
                console.log(`No answers found for page key ${pageKeyToClear} to clear for user ${username}.`);
            }
        }
        // Guardar respuestas de la página actual SI se enviaron Y NO estamos solo reseteando score/mistakes
        else if (lastSubmittedAnswers !== null && lastSubmittedAnswers !== undefined && !resetScoreAndMistakesOnly) {
            const pageKeyToAdd = `${currentSection}-${currentIndex}`;
            console.log(`Saving answers for page key: ${pageKeyToAdd} for user ${username}`);
            newQuizState.submittedAnswersByPage[pageKeyToAdd] = lastSubmittedAnswers;
        }
        // Si no se cumple ninguna condición de modificación de respuestas, se quedan como estaban.

        // 3. Guardar el objeto newQuizState COMPLETO en la base de datos
        await updateUserQuizState(username, newQuizState);

        res.status(200).json({ message: 'Estado del quiz guardado exitosamente.' });

    } catch (error) {
         console.error(`/api/save-quiz-state Error for "${username}":`, error);
         if (error.message.includes('User not found')) {
              return res.status(404).json({ message: `Usuario '${username}' no encontrado al guardar estado.` });
         }
         res.status(500).json({ message: 'Error interno del servidor al guardar el estado.' });
    }
});

app.get('/api/get-quiz-state', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Nombre de usuario es requerido.' });

    try {
        // Obtener estado desde la BD
        const quizState = await getUserQuizState(username);

        if (quizState) {
            // Usuario y estado encontrados, devolver el estado
            res.status(200).json(quizState);
        } else {
            // Usuario no encontrado
             console.log(`No user or state found for '${username}' in get-quiz-state.`);
             // Devolver un estado inicial por defecto consistentemente
             res.status(200).json({
                 score: 0, mistakes: 0, currentSection: 1, currentIndex: 1,
                 submittedAnswersByPage: {}, lastSaved: null
             });
            // O si prefieres indicar explícitamente que no se encontró:
            // res.status(404).json({ message: `Usuario '${username}' no encontrado.` });
        }
    } catch (error) {
        console.error(`/api/get-quiz-state Error for "${username}":`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


// --- Start Server ---
// ¡Se elimina el chequeo de fs.existsSync(DB_FILE)!
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port} o en la URL de Render`);
  // No necesitamos hacer nada con archivos aquí
});