// public/script.js (COMPLETO Y CORREGIDO CON RUTAS RELATIVAS)

console.log("--- script.js (Quiz Logic) Loaded ---");

// ==========================================
// Global Variables & Constants (Quiz Specific)
// ==========================================
let currentSection = 1;
let currentIndex = 1;
const totalFilesPerSection = { 1: 5, 2: 5, 3: 5, 4: 6 }; // Define la estructura de tus archivos de preguntas
let score = 0;
let mistakes = 0;
let loadedServerState = null; // Almacenará el estado completo cargado del backend

// --- Constantes de Navegación y API (¡Rutas Relativas!) ---
const LOGIN_PAGE_PATH = '/'; // Asumiendo que login/index.html está en la raíz de 'public'
// const QUIZ_PAGE = '/quiz.html'; // Ruta relativa si necesitas referenciarla
const SAVE_ENDPOINT = '/api/save-quiz-state'; // <-- CORREGIDO: Ruta relativa
const LOAD_ENDPOINT = '/api/get-quiz-state'; // <-- CORREGIDO: Ruta relativa

// ==========================================
// Utility Functions
// ==========================================
function arraysEqual(arr1, arr2) {
    // Función para comparar si dos arrays tienen los mismos elementos (independiente del orden)
    if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) return false;
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

// ==========================================
// Backend Interaction Functions
// ==========================================

/**
 * Guarda el estado actual del quiz en el backend.
 * @param {object|null} [submittedAnswersForCurrentPage=null] - Respuestas de la página específica que se acaba de enviar.
 * @param {boolean} [clearAllAnswers=false] - Indica al backend que borre TODAS las respuestas guardadas.
 * @param {boolean} [clearCurrentPageAnswers=false] - Indica al backend que borre solo las respuestas de la página actual.
 * @param {boolean} [resetScoreAndMistakesOnly=false] - Indica al backend que resetee SOLO puntuación/errores.
 */
async function saveQuizStateToBackend(
    submittedAnswersForCurrentPage = null,
    clearAllAnswers = false,
    clearCurrentPageAnswers = false,
    resetScoreAndMistakesOnly = false
) {
    const loggedInUser = localStorage.getItem('loggedInUser');
    // No intentar guardar si no hay usuario logueado
    if (!loggedInUser) {
        console.warn("saveQuizStateToBackend: No user logged in. Save skipped.");
        return;
    }

    const sectionAtSave = currentSection;
    const indexAtSave = currentIndex;

    // Determinar la acción para logging y posible lógica futura
    let action = 'Navigate'; // Acción por defecto (solo cambiar posición)
    if (resetScoreAndMistakesOnly) action = 'ResetScoreOnly';
    else if (clearAllAnswers) action = 'ClearAll';
    else if (clearCurrentPageAnswers) action = 'ClearCurrentPage';
    else if (submittedAnswersForCurrentPage) action = 'SubmitPage'; // Si se envían respuestas

    // Preparar los datos a enviar al backend
    const stateData = {
        username: loggedInUser,
        // Enviar puntuación/errores actuales, a menos que se estén reseteando explícitamente
        score: resetScoreAndMistakesOnly ? 0 : score,
        mistakes: resetScoreAndMistakesOnly ? 0 : mistakes,
        // Siempre enviar la ubicación actual
        currentSection: sectionAtSave,
        currentIndex: indexAtSave,
        // Enviar respuestas de la página actual si existen (o null si no)
        lastSubmittedAnswers: submittedAnswersForCurrentPage,
        // Enviar los flags para indicar acciones especiales
        clearAllAnswers: clearAllAnswers,
        clearCurrentPageAnswers: clearCurrentPageAnswers,
        resetScoreAndMistakesOnly: resetScoreAndMistakesOnly
    };

    console.log(`[Frontend] Attempting to save state (Action: ${action}) for user "${loggedInUser}":`, { section: sectionAtSave, index: indexAtSave });

    try {
        // Realizar la petición POST al backend usando la ruta relativa SAVE_ENDPOINT
        const response = await fetch(SAVE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stateData) // Convertir el objeto JS a string JSON
        });

        // Verificar si la petición fue exitosa (status 2xx)
        if (!response.ok) {
            // Si no fue exitosa, intentar leer el mensaje de error y lanzar un error
            const errorData = await response.text(); // Leer respuesta como texto por si no es JSON
            console.error(`[Frontend] Save state failed! Status: ${response.status}, Response: ${errorData}`);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
        }

        // Si fue exitosa, leer la respuesta JSON del backend
        const result = await response.json();
        console.log('[Frontend] Backend save successful:', result);

        // --- Actualizar estado local (loadedServerState) DESPUÉS de guardar exitosamente en backend ---
        // Esto mantiene la copia local sincronizada con lo que *debería* estar en la BD
        if (!loadedServerState) loadedServerState = { submittedAnswersByPage: {} }; // Inicializar si es null
        if (!loadedServerState.submittedAnswersByPage) loadedServerState.submittedAnswersByPage = {}; // Asegurar objeto de respuestas

        // Actualizar campos generales en el estado local
        loadedServerState.currentSection = sectionAtSave;
        loadedServerState.currentIndex = indexAtSave;
        loadedServerState.lastSaved = new Date().toISOString(); // Marcar cuándo se guardó

        // Actualizar puntuación/errores locales según la acción realizada
        if (resetScoreAndMistakesOnly || clearAllAnswers) {
            // Si se reseteó o se borró todo, poner a 0 localmente
            loadedServerState.score = 0;
            loadedServerState.mistakes = 0;
        } else {
            // Si no, reflejar la puntuación/errores globales actuales en el estado local
            loadedServerState.score = score;
            loadedServerState.mistakes = mistakes;
        }

        // Actualizar las respuestas guardadas localmente según la acción
        const pageKey = `${sectionAtSave}-${indexAtSave}`;
        if (clearAllAnswers) {
            loadedServerState.submittedAnswersByPage = {}; // Borrar todas las respuestas locales
            console.log("[Frontend] Cleared all answers in local state copy.");
        } else if (clearCurrentPageAnswers) {
            // Borrar solo las respuestas de la página actual localmente
            if (loadedServerState.submittedAnswersByPage[pageKey]) {
                delete loadedServerState.submittedAnswersByPage[pageKey];
                console.log(`[Frontend] Cleared answers for page ${pageKey} in local state copy.`);
            }
        } else if (submittedAnswersForCurrentPage !== null && !resetScoreAndMistakesOnly) {
             // Guardar las respuestas de la página actual localmente si se enviaron y no se está reseteando
            loadedServerState.submittedAnswersByPage[pageKey] = submittedAnswersForCurrentPage;
             console.log(`[Frontend] Updated answers for page ${pageKey} in local state copy.`);
        }
        // Si solo se navegó o se reseteó score/mistakes, las respuestas locales no cambian.

    } catch (error) {
        // Capturar errores de fetch (como ERR_CONNECTION_REFUSED, problemas de red) o errores lanzados arriba
        console.error('[Frontend] Error saving quiz state to backend:', error);
        // Aquí podrías mostrar un mensaje al usuario indicando que no se pudo guardar
    }
}

/**
 * Carga el estado del quiz del usuario desde el backend.
 * @returns {Promise<boolean>} True si el estado se cargó exitosamente (o se inicializó por defecto), False si hubo un error crítico.
 */
async function loadQuizStateFromBackend() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    // No intentar cargar si no hay usuario (debería haber sido redirigido)
    if (!loggedInUser) {
         console.warn("loadQuizStateFromBackend: No loggedInUser found in localStorage.");
         return false; // Indicar fallo o estado no cargado
    }

    console.log(`[Frontend] Attempting to load state for user "${loggedInUser}"...`);
    loadedServerState = null; // Resetear estado local antes de cargar

    try {
        // Realizar petición GET al backend usando la ruta relativa LOAD_ENDPOINT
        const response = await fetch(`${LOAD_ENDPOINT}?username=${encodeURIComponent(loggedInUser)}`, { method: 'GET' });

        // El backend (versión corregida) debería devolver 200 OK
        // tanto si encuentra el estado como si devuelve uno por defecto para usuario no encontrado.
        // Ya no esperamos un 404 explícito aquí si el backend maneja "no encontrado" con un default 200.

        // Verificar si la petición NO fue exitosa (ej. error 500 del servidor)
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Frontend] Load state failed! Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Leer la respuesta JSON (contendrá el estado guardado o el estado por defecto)
        const savedState = await response.json();
        console.log('[Frontend] State loaded from server:', savedState);

        // Asegurarse que la estructura básica existe en el objeto recibido
        if (!savedState) { // Si la respuesta JSON es inesperadamente null/undefined
            console.warn("[Frontend] Received null/undefined state from server. Using defaults.");
            loadedServerState = { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null };
        } else {
            // Asegurarse que la propiedad submittedAnswersByPage existe, incluso si está vacía
            if (!savedState.submittedAnswersByPage) {
                savedState.submittedAnswersByPage = {};
            }
            loadedServerState = savedState; // Asignar el estado cargado (o por defecto) a la variable local
        }

        // Aplicar el estado cargado (o por defecto) a las variables globales del quiz
        score = loadedServerState.score ?? 0; // Usar 0 si score es null/undefined
        mistakes = loadedServerState.mistakes ?? 0; // Usar 0 si mistakes es null/undefined

        // Validar y aplicar la sección e índice cargados
        if (loadedServerState.currentSection && totalFilesPerSection[loadedServerState.currentSection]) {
            currentSection = loadedServerState.currentSection;
            // Validar también el índice dentro de la sección
            currentIndex = (loadedServerState.currentIndex >= 1 && loadedServerState.currentIndex <= totalFilesPerSection[currentSection])
                ? loadedServerState.currentIndex
                : 1; // Si el índice guardado es inválido, volver al 1
        } else {
            // Si la sección guardada es inválida, volver a 1-1
            currentSection = 1;
            currentIndex = 1;
        }

        updateScoreDisplay(); // Actualizar la UI con los valores cargados
        return true; // Indicar que el estado se cargó/inicializó correctamente

    } catch (error) {
        // Capturar errores de fetch o errores lanzados arriba
        console.error('[Frontend] Error loading quiz state:', error);
        // En caso de error, usar un estado por defecto localmente para que la app no se rompa
        loadedServerState = { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null };
        currentSection = 1; currentIndex = 1; score = 0; mistakes = 0; updateScoreDisplay();
        // Aquí podrías mostrar un mensaje de error al usuario
        return false; // Indicar que hubo un error al cargar
    }
}

// ==========================================
// Quiz Display and Interaction Functions
// ==========================================
async function loadQuestions() {
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) { console.warn("loadQuestions: question-container element not found."); return; }

    const sectionToLoad = currentSection, indexToLoad = currentIndex;
    const pageKey = `${sectionToLoad}-${indexToLoad}`;
    console.log(`[Frontend] Rendering questions for page: ${pageKey}`);

    // --- URL Relativa para cargar JSON de preguntas ---
    // Asume que los archivos N-N.json están en la raíz de 'public'
    const questionFileUrl = `/${sectionToLoad}-${indexToLoad}.json`; // Ruta relativa al servidor web

    // Obtener respuestas guardadas para esta página específica desde el estado local cargado
    const answersForThisPage = loadedServerState?.submittedAnswersByPage?.[pageKey];
    // Determinar si la página ya fue enviada previamente
    const pageWasSubmitted = !!answersForThisPage;
    console.log(`[Frontend] Answers loaded for this page (${pageKey})? ${pageWasSubmitted ? 'Yes' : 'No'}`);

    try {
        // Cargar el archivo JSON de preguntas para la página actual
        const response = await fetch(questionFileUrl);
        if (!response.ok) {
            // Si no se encuentra el archivo JSON (404) u otro error
            const errorText = await response.text();
            console.error(`[Frontend] Failed to load question file ${questionFileUrl}. Status: ${response.status}. Response: ${errorText}`);
            throw new Error(`HTTP ${response.status} loading question file ${questionFileUrl}`);
        }
        // Parsear el JSON
        const jsonData = await response.json();
        // Vaciar el contenedor antes de añadir nuevas preguntas
        questionContainer.innerHTML = '';

        // Iterar sobre cada pregunta en el archivo JSON
        jsonData.forEach((item) => {
            // Crear el contenedor principal para la pregunta
            const questionDiv = document.createElement('div');
            questionDiv.className = 'mb-4 p-4 border rounded bg-white shadow-sm question-box';
            // Obtener el ID de la pregunta
            const questionId = item.karten_nummer?.toString();
            if (!questionId) { console.warn("Skipping question item missing karten_nummer:", item); return; }
            questionDiv.dataset.questionId = questionId; // Guardar ID en el dataset

            // Crear y añadir el título de la pregunta
            const questionTitle = document.createElement('h3');
            questionTitle.className = 'text-dark mb-3';
            questionTitle.textContent = `${questionId}. ${item.original_frage || 'Frage ohne Text'}`; // Texto original o fallback
            questionDiv.appendChild(questionTitle);

            // Buscar la versión Multiple Choice de la pregunta
            const altQuestion = item.alternativfragen?.find(alt => alt.typ === 'multiple_choice');

            // Si existe la versión Multiple Choice y tiene opciones
            if (altQuestion?.optionen) {
                const optionsDiv = document.createElement('div'); optionsDiv.className = 'mt-2';
                // Obtener las respuestas correctas para esta pregunta
                const correctAnswersForThisQ = altQuestion.korrekte_antworten || [];
                // Guardar respuestas correctas en el dataset para usarlas al corregir
                questionDiv.dataset.correctAnswers = JSON.stringify(correctAnswersForThisQ);

                // Crear los checkboxes para cada opción
                Object.entries(altQuestion.optionen).forEach(([key, text], idx) => {
                    const optionId = `q${questionId}-${idx}`; // ID único para el input y label
                    const optionContainer = document.createElement('div'); optionContainer.className = 'form-check mb-2';
                    // Input checkbox
                    const input = document.createElement('input');
                    input.type = 'checkbox'; input.id = optionId; input.name = `question-${questionId}`; input.value = key; input.className = 'form-check-input';
                    // Marcar si ya fue respondida y estaba seleccionada
                    input.checked = pageWasSubmitted && answersForThisPage[questionId]?.includes(key);
                    // Deshabilitar si la página ya fue enviada
                    input.disabled = pageWasSubmitted;
                    // Label para el checkbox
                    const label = document.createElement('label');
                    label.className = 'form-check-label'; label.setAttribute('for', optionId); label.textContent = text || `Option ${key}`; // Texto de la opción o fallback

                    optionContainer.appendChild(input); optionContainer.appendChild(label); optionsDiv.appendChild(optionContainer);
                });
                questionDiv.appendChild(optionsDiv); // Añadir opciones al div de la pregunta

                 // Si la página ya fue enviada, marcar como correcta/incorrecta y resaltar correctas
                 if (pageWasSubmitted && answersForThisPage?.[questionId]) {
                    const submitted = answersForThisPage[questionId]; // Respuestas enviadas por el usuario
                    const isCorrect = arraysEqual(submitted, correctAnswersForThisQ); // Comparar
                    questionDiv.classList.add(isCorrect ? 'correct-answer' : 'incorrect-answer'); // Añadir clase CSS
                     // Si fue incorrecta, resaltar las que sí eran correctas
                     if(!isCorrect) {
                         questionDiv.querySelectorAll('.form-check input').forEach(inp => {
                             if (correctAnswersForThisQ.includes(inp.value)) {
                                 inp.closest('.form-check').classList.add('highlight-correct');
                             }
                         });
                     }
                 }
            } else {
                // Si no hay versión Multiple Choice
                questionDiv.appendChild(Object.assign(document.createElement('p'), {textContent:"Keine Multiple-Choice verfügbar.", className:"text-muted"}));
            }
            // Añadir el div de la pregunta completa al contenedor principal
            questionContainer.appendChild(questionDiv);
        });

        // Actualizar UI después de cargar preguntas
        updateScoreDisplay();
        updateButtons(); // Habilitar/deshabilitar botones de navegación/envío

    } catch (error) {
        // Capturar errores al cargar/procesar el JSON de preguntas
        console.error(`[Frontend] Error in loadQuestions for ${pageKey} from ${questionFileUrl}:`, error);
        // Mostrar mensaje de error en la página
        questionContainer.innerHTML = `<div class="alert alert-danger">Fehler beim Laden der Fragen für Seite ${pageKey}: ${error.message}. Prüfen Sie die Konsole (F12).</div>`;
    }
}

// Función que se ejecuta al hacer clic en "Antwort senden"
function captureAnswers(event) {
    if (event) event.preventDefault(); // Prevenir envío de formulario si está dentro de uno
    console.log("[Frontend] captureAnswers called");
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) { console.warn("captureAnswers: container missing."); return; }

    let correctCount = 0, incorrectCount = 0;
    const currentQuestionnaireAnswers = {}; // Objeto para guardar las respuestas de esta página

    // Iterar sobre cada caja de pregunta visible
    questionContainer.querySelectorAll('.question-box').forEach((questionDiv) => {
        const questionId = questionDiv.dataset.questionId;
        if (!questionId) return; // Saltar si falta ID

        // Obtener las respuestas correctas guardadas en el dataset
        const correctAnswers = JSON.parse(questionDiv.dataset.correctAnswers || "[]");
        // Encontrar los checkboxes que NO están deshabilitados (los que el usuario podía marcar)
        const inputs = questionDiv.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        // Obtener los valores de los checkboxes marcados
        const selectedAnswers = Array.from(inputs).filter(i => i.checked).map(i => i.value);
        // Guardar las respuestas seleccionadas para esta pregunta
        currentQuestionnaireAnswers[questionId] = selectedAnswers;

        // Limpiar clases de corrección previas y resaltado
        questionDiv.classList.remove('correct-answer', 'incorrect-answer');
        questionDiv.querySelectorAll('.highlight-correct').forEach(el => el.classList.remove('highlight-correct'));

        // Comparar respuestas seleccionadas con las correctas
        const isCorrect = arraysEqual(selectedAnswers, correctAnswers);
        if (isCorrect) {
            correctCount++; // Incrementar contador de correctas
            questionDiv.classList.add('correct-answer'); // Marcar visualmente como correcta
        } else {
            incorrectCount++; // Incrementar contador de incorrectas
            questionDiv.classList.add('incorrect-answer'); // Marcar visualmente como incorrecta
            // Resaltar cuáles eran las respuestas correctas
            questionDiv.querySelectorAll('.form-check input').forEach(inp => {
                if (correctAnswers.includes(inp.value)) {
                    inp.closest('.form-check').classList.add('highlight-correct');
                }
            });
        }
        // Deshabilitar todos los checkboxes de esta pregunta después de corregir
        questionDiv.querySelectorAll('input[type="checkbox"]').forEach(i => i.disabled = true);
    });

    console.log('\n--- [Frontend] Submission Complete ---');
    // Actualizar puntuación global
    score += correctCount;
    mistakes += incorrectCount;
    console.log(` -> Round Result: +${correctCount} Correct, +${incorrectCount} Incorrect.`);
    console.log(` -> New Total: ${score} Correct, ${mistakes} Incorrect.`);
    updateScoreDisplay(); // Actualizar UI de puntuación
    // Deshabilitar el botón de enviar después de usarlo
    document.getElementById('submit-btn')?.setAttribute('disabled', 'true');

    // Guardar el estado (incluyendo las respuestas de esta página) en el backend
    saveQuizStateToBackend(currentQuestionnaireAnswers, false, false, false); // Acción 'SubmitPage'
}

// Actualiza los contadores de puntuación en la UI
function updateScoreDisplay() {
    const scoreEl = document.getElementById('score'), mistakesEl = document.getElementById('mistakes');
     if (scoreEl) scoreEl.textContent = `Richtige Antworten: ${score}`;
     if (mistakesEl) mistakesEl.textContent = `Falsche Antworten: ${mistakes}`;
}

// Función para el botón "Fragen zurücksetzen" (Resetear preguntas de la página actual)
async function resetQuestions() {
    console.log("[Frontend] resetQuestions called - Clearing answers for current page & reloading.");
    const pageKey = `${currentSection}-${currentIndex}`;
    // Eliminar respuestas de esta página del estado local cargado (si existen)
    if (loadedServerState?.submittedAnswersByPage?.[pageKey]) {
        delete loadedServerState.submittedAnswersByPage[pageKey];
    }
    // Guardar estado en backend, indicando que se borren las respuestas de la página actual
    await saveQuizStateToBackend(null, false, true, false); // Flag clearCurrentPageAnswers = true
    // Volver a cargar las preguntas de la página actual (ahora aparecerán sin responder)
    await loadQuestions(); // Añadir await aquí por si acaso
}

// Función para el botón "Punkte zurücksetzen" (Resetear solo puntuación y errores)
async function resetScore() {
     console.log("[Frontend] resetScore called - Resetting score/mistakes ONLY.");
      // Resetear variables globales locales
      score = 0;
      mistakes = 0;

      // Actualizar también el estado local cargado (sin tocar las respuestas)
      if (loadedServerState) {
          loadedServerState.score = 0;
          loadedServerState.mistakes = 0;
          console.log("[Frontend] Reset score/mistakes in local loadedServerState copy.")
      } else {
           // Si por alguna razón no había estado local, crear uno básico
          loadedServerState = { score: 0, mistakes: 0, currentSection: currentSection, currentIndex: currentIndex, submittedAnswersByPage: {}, lastSaved: null };
      }
      updateScoreDisplay(); // Actualizar UI inmediatamente

      // Guardar estado en backend, indicando que solo se resetean puntuación/errores
      await saveQuizStateToBackend(null, false, false, true); // Flag resetScoreAndMistakesOnly = true

      console.log("[Frontend] Score/Mistakes reset completed.");
      // No es necesario recargar preguntas (loadQuestions) ya que las respuestas no cambiaron
}

// Función para el botón "Weiter" (Siguiente)
async function nextQuestionnaire() { // Hacer async para usar await
     console.log("[Frontend] nextQuestionnaire called.");
     let targetSection = currentSection, targetIndex = currentIndex, canMove = false;
     // Calcular siguiente página (dentro de la sección o a la siguiente sección)
      if (currentIndex < totalFilesPerSection[currentSection]) { // Misma sección, siguiente índice
          targetIndex++;
          canMove = true;
      } else if (currentSection < Object.keys(totalFilesPerSection).length) { // Último índice, pasar a la siguiente sección
          targetSection++;
          targetIndex = 1; // Empezar en el índice 1 de la nueva sección
          canMove = true;
      }

      if (canMove) {
          console.log(`[Frontend] Moving to next page: ${targetSection}-${targetIndex}`);
          // Actualizar variables globales de posición
          currentSection = targetSection;
          currentIndex = targetIndex;
          // Guardar el estado actual (solo la nueva posición) en el backend
          await saveQuizStateToBackend(null, false, false, false); // Acción 'Navigate'
          // Cargar las preguntas de la nueva página
          await loadQuestions(); // Esperar a que carguen
      } else {
          // Si no se puede mover más (ya está en la última página)
          console.log("[Frontend] Already at last questionnaire.");
          const qC = document.getElementById('question-container');
          // Mostrar mensaje de finalización si no existe ya
          if(qC && !qC.querySelector('.completion-message')) {
               qC.innerHTML += `<div class="alert alert-success text-center mt-4 completion-message">Alle Fragen abgeschlossen! Gut gemacht!</div>`;
          }
          // Deshabilitar botón "Weiter"
          document.getElementById('next-btn')?.setAttribute('disabled', 'true');
      }
}

// Función para el botón "Zurück" (Anterior)
async function prevQuestionnaire() { // Hacer async para usar await
     console.log("[Frontend] prevQuestionnaire called.");
     let targetSection = currentSection, targetIndex = currentIndex, canMove = false;
      // Calcular página anterior (dentro de la sección o a la sección anterior)
      if (currentIndex > 1) { // Misma sección, índice anterior
          targetIndex--;
          canMove = true;
      } else if (currentSection > 1) { // Primer índice, ir al último índice de la sección anterior
          targetSection--;
          // Asegurarse que la sección anterior existe en la configuración
          if (totalFilesPerSection[targetSection]) {
              targetIndex = totalFilesPerSection[targetSection]; // Ir al último índice
              canMove = true;
          }
      }

      if (canMove) {
          console.log(`[Frontend] Moving to previous page: ${targetSection}-${targetIndex}`);
          // Actualizar variables globales de posición
          currentSection = targetSection;
          currentIndex = targetIndex;
          // Guardar el estado actual (solo la nueva posición) en el backend
          await saveQuizStateToBackend(null, false, false, false); // Acción 'Navigate'
          // Cargar las preguntas de la nueva página
          await loadQuestions(); // Esperar a que carguen
      } else if (currentSection === 1 && currentIndex === 1) {
          // Si ya está en la primera página
          console.log("[Frontend] Already at first questionnaire.");
      }
}

// Habilita/deshabilita los botones según el estado actual
function updateButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const questionContainer = document.getElementById('question-container');

    // Habilitar/deshabilitar botón "Zurück"
    if (prevBtn) {
        prevBtn.disabled = (currentSection === 1 && currentIndex === 1); // Deshabilitado solo en la primera página (1-1)
    }

    // Habilitar/deshabilitar botón "Weiter"
    let isLastPage = false;
    const sections = Object.keys(totalFilesPerSection).map(Number); // Obtener secciones como números
    if (sections.length > 0 && totalFilesPerSection[currentSection]) {
        const lastSection = Math.max(...sections); // Encontrar la última sección
        isLastPage = (currentSection === lastSection && currentIndex === totalFilesPerSection[currentSection]); // Comprobar si es la última página de la última sección
    }
    if (nextBtn) {
        nextBtn.disabled = isLastPage; // Deshabilitado si es la última página
    }

    // Habilitar/deshabilitar botón "Antwort senden"
    // Habilitado solo si hay checkboxes activos (no deshabilitados) en la página actual
    let inputsEnabled = questionContainer?.querySelector('input[type="checkbox"]:not(:disabled)');
    if (submitBtn) {
        submitBtn.disabled = !inputsEnabled; // Deshabilitado si no hay inputs activos
    }
}

// Función para el botón "Logout"
async function handleLogout() {
     console.log("[Frontend] handleLogout executing.");
     // Intentar guardar el estado una última vez antes de salir
     await saveQuizStateToBackend(null, false, false, false); // Acción 'Navigate' (guarda posición/score)
     // Eliminar usuario del almacenamiento local
     localStorage.removeItem('loggedInUser');
     // Redirigir a la página de login (usando la ruta relativa)
     window.location.href = LOGIN_PAGE_PATH;
}

// ==========================================
// Page Initialization Logic (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("--- [Frontend] DOMContentLoaded Fired ---");

    // Comprobar si estamos en la página del quiz buscando un elemento clave
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) {
        console.log("[Frontend] Not on quiz page (no question-container found). Exiting quiz init.");
        return; // No ejecutar lógica del quiz si no estamos en quiz.html
    }

    console.log("[Frontend] Executing quiz page specific logic.");

    // Verificar si hay un usuario logueado en localStorage
    const user = localStorage.getItem('loggedInUser');
    if (!user) {
        // Si no hay usuario, redirigir inmediatamente a la página de login
        console.log("[Frontend] No user logged in. Redirecting to login page:", LOGIN_PAGE_PATH);
        window.location.href = LOGIN_PAGE_PATH;
        return; // Detener la ejecución del script aquí
    }

    // Si hay usuario, inicializar la página del quiz
    console.log(`[Frontend] User "${user}" logged in. Initializing quiz...`);

    // Mostrar mensaje de bienvenida y sección del cuestionario
    const welcomeSection = document.getElementById('welcome-section');
    const welcomeMessage = document.getElementById('welcome-message');
    const questionnaireSection = document.getElementById('questionnaire-section');
    if (welcomeSection) welcomeSection.style.display = 'flex'; // O 'block' según tu layout
    if (welcomeMessage) welcomeMessage.textContent = `Willkommen, ${user}!`;
    if (questionnaireSection) questionnaireSection.style.display = 'block';

    // Añadir listeners a los botones (asegurándose de no añadirlos múltiples veces)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && !logoutBtn.dataset.listenerAttached) {
        logoutBtn.addEventListener('click', handleLogout);
        logoutBtn.dataset.listenerAttached = 'true';
    }
    // Añadir listeners para los botones de control del quiz
    document.getElementById('submit-btn')?.addEventListener('click', captureAnswers);
    document.getElementById('next-btn')?.addEventListener('click', nextQuestionnaire);
    document.getElementById('prev-btn')?.addEventListener('click', prevQuestionnaire);
    document.getElementById('reset-questions-btn')?.addEventListener('click', resetQuestions);
    document.getElementById('reset-score-btn')?.addEventListener('click', resetScore);

    // Cargar el estado del quiz guardado para este usuario desde el backend
    await loadQuizStateFromBackend(); // Esperar a que el estado se cargue

    // Log del estado después de cargar (útil para depurar)
    console.log(`[Frontend] State after load/init: Section=${currentSection}, Index=${currentIndex}, Score=${score}, Mistakes=${mistakes}`);

    // Cargar las preguntas correspondientes al estado cargado/inicializado
    await loadQuestions(); // Esperar a que las preguntas se carguen y rendericen

    console.log("--- [Frontend] DOMContentLoaded processing finished ---");
});

console.log("--- script.js (Quiz Logic) Parsed ---");