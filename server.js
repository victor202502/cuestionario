// server.js (COMPLETO Y CORREGIDO PARA USAR POSTGRESQL)

require('dotenv').config(); // Carga .env si existe (para desarrollo local)
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
const db = require('./db'); // Importar el módulo de conexión a la BD

const app = express();
// Usar el puerto proporcionado por Render (process.env.PORT) o 3000 localmente
const port = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors()); // Permitir peticiones de diferentes orígenes si es necesario
app.use(express.json()); // Para parsear cuerpos JSON de API requests

// Servir archivos estáticos desde la carpeta 'public'
// Asegúrate que tus archivos HTML, CSS, JS del cliente y JSON de preguntas están en 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Funciones de Base de Datos ---
// (Estas funciones interactúan con la base de datos PostgreSQL)

async function findUserByUsername(username) {
  const queryText = 'SELECT * FROM users WHERE username = $1';
  try {
    const result = await db.query(queryText, [username]);
    return result.rows[0]; // Devuelve el usuario encontrado o undefined
  } catch (err) {
    console.error('Error finding user by username:', err);
    throw err; // Propaga el error para manejarlo en la ruta
  }
}

async function createUser(username, hashedPassword) {
  // Inserta el nuevo usuario. quiz_state usará el DEFAULT de la tabla ('{}'::jsonb)
  const queryText = `
    INSERT INTO users (username, password, quiz_state)
    VALUES ($1, $2, DEFAULT)
    RETURNING id, username, quiz_state`;
  try {
    const result = await db.query(queryText, [username, hashedPassword]);
    return result.rows[0]; // Devuelve los datos básicos del usuario creado
  } catch (err) {
    console.error('Error creating user:', err);
    // Manejo específico para violación de constraint UNIQUE (usuario ya existe)
    if (err.code === '23505') {
        throw new Error('Username already exists');
    }
    throw err; // Relanza otros errores
  }
}

async function getUserQuizState(username) {
  // Selecciona solo la columna quiz_state
  const queryText = 'SELECT quiz_state FROM users WHERE username = $1';
   try {
    const result = await db.query(queryText, [username]);
    if (result.rows.length > 0) {
      // Si el usuario existe, devuelve su quiz_state.
      // Si quiz_state es null en la BD (no debería por el DEFAULT), devuelve un objeto vacío por seguridad.
      return result.rows[0].quiz_state || { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null };
    } else {
      // Si el usuario no existe, devuelve null.
      return null;
    }
  } catch (err) {
    console.error(`Error getting quiz state for user "${username}":`, err);
    throw err;
  }
}

async function updateUserQuizState(username, newQuizState) {
  // Actualiza la columna quiz_state para el usuario especificado
  const queryText = 'UPDATE users SET quiz_state = $1 WHERE username = $2 RETURNING username'; // RETURNING para confirmar
   try {
    // El driver 'pg' convierte automáticamente el objeto JS 'newQuizState' a formato JSONB
    const result = await db.query(queryText, [newQuizState, username]);
     if (result.rowCount === 0) {
       // Si rowCount es 0, significa que no se encontró ningún usuario con ese username para actualizar.
       throw new Error('User not found, cannot update quiz state');
     }
     console.log(`[DB Update] Quiz state updated successfully in DB for user: ${username}`);
     return true; // Indica éxito
  } catch (err) {
    console.error(`Error updating quiz state for user "${username}":`, err);
    throw err;
  }
}

// --- Rutas de API (Usando las funciones de Base de Datos) ---

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  // Validación básica
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ message: 'Valid username and password (min 6 chars) required.' });
  }
  try {
    // Verificar si el usuario ya existe
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      console.log(`Registration failed: Username "${username}" already exists.`);
      return res.status(409).json({ message: 'El nombre de usuario ya existe' });
    }

    // Hashear contraseña y crear usuario
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser(username, hashedPassword);
    console.log(`User "${username}" registered successfully.`);
    // Responder al cliente
    res.status(201).json({ message: 'Usuario registrado exitosamente', username: newUser.username });

  } catch (error) {
     // Manejar error específico de duplicado
     if (error.message === 'Username already exists') {
        console.log(`Registration failed (duplicate): Username "${username}" already exists.`);
        return res.status(409).json({ message: 'El nombre de usuario ya existe' });
     }
     // Manejar otros errores internos
     console.error("/register Error:", error);
     res.status(500).json({ message: 'Error interno del servidor al registrar' });
  }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos' });
    }
    try {
        // Buscar usuario por username
        const user = await findUserByUsername(username);
        // Si no se encuentra el usuario
        if (!user) {
            console.log(`Login attempt failed: User "${username}" not found.`);
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // Comparar la contraseña proporcionada con la hasheada en la BD
        const isMatch = await bcrypt.compare(password, user.password);
        // Si las contraseñas no coinciden
        if (!isMatch) {
             console.log(`Login attempt failed: Incorrect password for user "${username}".`);
             return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // Si todo es correcto, login exitoso
        console.log(`Login successful for user "${username}".`);
        res.status(200).json({ message: 'Login exitoso', username: user.username });

    } catch (error) {
        console.error(`/login Error for "${username}":`, error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Ruta para guardar el estado del quiz
app.post('/api/save-quiz-state', async (req, res) => {
    console.log('--- SAVE QUIZ STATE START ---'); // Log inicio
    // Extraer todos los datos esperados del cuerpo de la solicitud
    const { username, score, mistakes, currentSection, currentIndex, lastSubmittedAnswers, clearAllAnswers, clearCurrentPageAnswers, resetScoreAndMistakesOnly } = req.body;
    console.log(`[Save State] Received for user: ${username}`);
    console.log(`[Save State] Request Body:`, req.body); // Log detallado del cuerpo

    // Validación de datos esenciales
    if (!username || typeof currentSection !== 'number' || typeof currentIndex !== 'number') {
         console.log('[Save State] Validation failed: Missing username, currentSection, or currentIndex.');
         return res.status(400).json({ message: 'Usuario, sección actual e índice actual son requeridos.' });
    }
     // Validar score y mistakes solo si no estamos reseteándolos explícitamente
     if (!resetScoreAndMistakesOnly && (typeof score !== 'number' || typeof mistakes !== 'number')) {
         console.log('[Save State] Validation failed: Missing or invalid score/mistakes when not resetting.');
         return res.status(400).json({ message: 'Datos de puntuación inválidos.' });
     }

    try {
        // 1. Obtener el estado ACTUAL del quiz del usuario desde la BD
        console.log(`[Save State] Getting current state for ${username}...`);
        let currentState = await getUserQuizState(username);
        console.log(`[Save State] Current state fetched from DB:`, currentState);

        // Si el usuario no existe (getUserQuizState devolvió null)
        if (!currentState) {
             console.log(`[Save State] ERROR: User "${username}" not found when trying to save state.`);
             return res.status(404).json({ message: `Usuario '${username}' no encontrado.` });
        }

        // 2. Construir el NUEVO objeto quizState basado en el estado actual y los cambios del request
        // Empezamos con una copia segura del estado actual (o un objeto vacío si es null/inválido)
        const newQuizState = {
            ...(currentState || {}), // Copia segura
            // Actualizar campos generales según los datos del request
            currentSection: currentSection,
            currentIndex: currentIndex,
            lastSaved: new Date().toISOString(), // Siempre actualizar timestamp
            // Actualizar score/mistakes según los flags y los datos del request
            score: resetScoreAndMistakesOnly ? 0 : score, // Reset a 0 o usa el valor del request
            mistakes: resetScoreAndMistakesOnly ? 0 : mistakes, // Reset a 0 o usa el valor del request
            // Manejar las respuestas guardadas por página
            submittedAnswersByPage: { ...(currentState.submittedAnswersByPage || {}) } // Copia segura del objeto de respuestas
        };

        // Aplicar la lógica para modificar el objeto submittedAnswersByPage en newQuizState
        if (clearAllAnswers === true) {
            console.log(`[Save State] Clearing ALL submitted answers for user ${username}.`);
            newQuizState.submittedAnswersByPage = {}; // Reemplazar con objeto vacío
        }
        else if (clearCurrentPageAnswers === true) {
            // Eliminar respuestas solo para la página actual
            const pageKeyToClear = `${currentSection}-${currentIndex}`;
            if (newQuizState.submittedAnswersByPage[pageKeyToClear]) {
                console.log(`[Save State] Clearing answers for current page key: ${pageKeyToClear} for user ${username}.`);
                delete newQuizState.submittedAnswersByPage[pageKeyToClear];
            } else {
                console.log(`[Save State] No answers found for page key ${pageKeyToClear} to clear for user ${username}.`);
            }
        }
        // Guardar respuestas de la página actual SI se enviaron (lastSubmittedAnswers no es null/undefined)
        // Y SI no estamos en modo "resetear solo score/mistakes"
        else if (lastSubmittedAnswers !== null && lastSubmittedAnswers !== undefined && !resetScoreAndMistakesOnly) {
            const pageKeyToAdd = `${currentSection}-${currentIndex}`;
            console.log(`[Save State] Saving answers for page key: ${pageKeyToAdd} for user ${username}:`, lastSubmittedAnswers);
            newQuizState.submittedAnswersByPage[pageKeyToAdd] = lastSubmittedAnswers;
        }
        // Si ninguna de estas condiciones se cumple, submittedAnswersByPage se queda como estaba en currentState.

        // Log del objeto estado que se va a guardar
        console.log(`[Save State] New state constructed to be saved:`, newQuizState);

        // 3. Guardar el objeto newQuizState COMPLETO en la columna quiz_state de la BD
        console.log(`[Save State] Calling updateUserQuizState for ${username}...`);
        await updateUserQuizState(username, newQuizState);
        console.log(`[Save State] Update successful call returned for ${username}.`);

        // Responder al cliente con éxito
        res.status(200).json({ message: 'Estado del quiz guardado exitosamente.' });
        console.log('--- SAVE QUIZ STATE END (SUCCESS) ---');

    } catch (error) {
         // Capturar y loguear cualquier error durante el proceso
         console.error(`!!! [Save State] CATCH BLOCK ERROR for "${username}":`, error);
         // Manejar error específico si el usuario no se encontró durante el UPDATE
         if (error.message.includes('User not found')) {
              return res.status(404).json({ message: `Usuario '${username}' no encontrado al intentar guardar estado.` });
         }
         // Responder con error genérico del servidor
         res.status(500).json({ message: 'Error interno del servidor al guardar el estado.' });
         console.log('--- SAVE QUIZ STATE END (WITH CATCH ERROR) ---');
    }
});

// Ruta para obtener el estado del quiz
app.get('/api/get-quiz-state', async (req, res) => {
    console.log('--- GET QUIZ STATE START ---'); // Log inicio
    const { username } = req.query;
    console.log(`[Get State] Received request for user: ${username}`);

    // Validar que el username fue proporcionado
    if (!username) {
        console.log('[Get State] Validation failed: Username is required.');
        return res.status(400).json({ message: 'Nombre de usuario es requerido.' });
    }

    try {
        // Obtener estado del quiz desde la BD usando la función helper
        console.log(`[Get State] Calling getUserQuizState for ${username}...`);
        const quizState = await getUserQuizState(username);
        console.log(`[Get State] State fetched from DB for ${username}:`, quizState);

        // Si se encontró un estado (incluso el objeto por defecto si el usuario existe pero quiz_state era null)
        if (quizState) {
            res.status(200).json(quizState); // Devolver el estado encontrado
        } else {
            // Si getUserQuizState devolvió null (usuario no encontrado en la BD)
             console.log(`[Get State] User or state not found for '${username}', returning default state structure.`);
             // Devolver un estado inicial por defecto para consistencia con el frontend
             res.status(200).json({
                 score: 0, mistakes: 0, currentSection: 1, currentIndex: 1,
                 submittedAnswersByPage: {}, lastSaved: null
             });
            // Alternativa: Podrías devolver 404 si quieres que el frontend maneje explícitamente "usuario no encontrado"
            // return res.status(404).json({ message: `Usuario '${username}' no encontrado.` });
        }
        console.log('--- GET QUIZ STATE END (SUCCESS) ---');

    } catch (error) {
        // Capturar y loguear cualquier error durante la obtención del estado
        console.error(`!!! [Get State] CATCH BLOCK ERROR for "${username}":`, error);
        // Responder con error genérico del servidor
        res.status(500).json({ message: 'Error interno del servidor.' });
        console.log('--- GET QUIZ STATE END (WITH CATCH ERROR) ---');
    }
});


// --- Iniciar el Servidor ---
app.listen(port, () => {
  // Mensaje indicando que el servidor está listo y en qué puerto
  console.log(`Servidor escuchando en http://localhost:${port} o en la URL asignada por Render`);
});