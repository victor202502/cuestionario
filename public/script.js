console.log("--- script.js (Quiz Logic) Loaded ---");

// ==========================================
// Global Variables & Constants (Quiz Specific)
// ==========================================
let currentSection = 1;
let currentIndex = 1;
const totalFilesPerSection = { 1: 5, 2: 5, 3: 5, 4: 6 }; // Example structure
let score = 0;
let mistakes = 0;
let loadedServerState = null; // Stores the entire state object from backend

const LOGIN_PAGE = 'index.html';
const QUIZ_PAGE = 'quiz.html';
const SAVE_ENDPOINT = 'http://localhost:3000/api/save-quiz-state';
const LOAD_ENDPOINT = 'http://localhost:3000/api/get-quiz-state';

// ==========================================
// Utility Functions
// ==========================================
function arraysEqual(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) return false;
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

// ==========================================
// Backend Interaction Functions
// ==========================================

/**
 * Saves the current quiz state to the backend.
 * @param {object} [submittedAnswersForCurrentPage=null] - Answers for the *specific page* just submitted.
 * @param {boolean} [clearAllAnswers=false] - Flag to tell backend to clear ALL stored answers.
 * @param {boolean} [clearCurrentPageAnswers=false] - Flag to tell backend to clear answers for CURRENT page only.
 * @param {boolean} [resetScoreAndMistakesOnly=false] - Flag to tell backend to reset ONLY score/mistakes. // <-- NEW PARAM
 */
async function saveQuizStateToBackend(
    submittedAnswersForCurrentPage = null,
    clearAllAnswers = false,
    clearCurrentPageAnswers = false,
    resetScoreAndMistakesOnly = false // <-- NEW PARAM
) {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        console.warn("saveQuizStateToBackend: No user logged in.");
        return;
    }

    const sectionAtSave = currentSection;
    const indexAtSave = currentIndex;

    // Determine the action for logging
    let action = 'Navigate';
    if (resetScoreAndMistakesOnly) action = 'ResetScoreOnly';
    else if (clearAllAnswers) action = 'ClearAll';
    else if (clearCurrentPageAnswers) action = 'ClearCurrentPage';
    else if (submittedAnswersForCurrentPage) action = 'SubmitPage';

    const stateData = {
        username: loggedInUser,
        // Send current values UNLESS just resetting score/mistakes
        score: resetScoreAndMistakesOnly ? 0 : score,
        mistakes: resetScoreAndMistakesOnly ? 0 : mistakes,
        currentSection: sectionAtSave,
        currentIndex: indexAtSave,
        lastSubmittedAnswers: submittedAnswersForCurrentPage,
        clearAllAnswers: clearAllAnswers,
        clearCurrentPageAnswers: clearCurrentPageAnswers,
        resetScoreAndMistakesOnly: resetScoreAndMistakesOnly // <-- Send new flag
    };

    console.log(`Attempting to save state (Action: ${action}):`, { section: sectionAtSave, index: indexAtSave });

    try {
        const response = await fetch(SAVE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stateData)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
        }

        const result = await response.json();
        console.log('Backend save successful:', result);

        // --- Update local state *after* successful save ---
        if (!loadedServerState) loadedServerState = { submittedAnswersByPage: {} };
        if (!loadedServerState.submittedAnswersByPage) loadedServerState.submittedAnswersByPage = {};

        // Update general local state (location, timestamp always update)
        loadedServerState.currentSection = sectionAtSave;
        loadedServerState.currentIndex = indexAtSave;
        loadedServerState.lastSaved = new Date().toISOString();

        // Update local score/mistakes based on action
        if (resetScoreAndMistakesOnly || clearAllAnswers) {
            loadedServerState.score = 0;
            loadedServerState.mistakes = 0;
        } else {
            // Otherwise, reflect the current global score/mistakes
            loadedServerState.score = score;
            loadedServerState.mistakes = mistakes;
        }

        const pageKey = `${sectionAtSave}-${indexAtSave}`;

        // Update local answers based on action performed
        if (clearAllAnswers) {
            loadedServerState.submittedAnswersByPage = {};
            console.log("Cleared all answers in local state.");
        } else if (clearCurrentPageAnswers) {
            if (loadedServerState.submittedAnswersByPage[pageKey]) {
                delete loadedServerState.submittedAnswersByPage[pageKey];
                console.log(`Cleared answers for page ${pageKey} in local state.`);
            }
        } else if (submittedAnswersForCurrentPage !== null && !resetScoreAndMistakesOnly) {
             // Don't update page answers if only resetting score
            loadedServerState.submittedAnswersByPage[pageKey] = submittedAnswersForCurrentPage;
             console.log(`Updated answers for page ${pageKey} in local state.`);
        }
        // If resetScoreOnly=true or just navigating, local answers remain unchanged.

        // console.log("Updated local loadedServerState:", loadedServerState); // Optional log


    } catch (error) {
        console.error('Error saving quiz state to backend:', error);
    }
}


async function loadQuizStateFromBackend() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) return false;
    console.log(`Attempting to load state for user ${loggedInUser}...`);
    loadedServerState = null;
    try {
        const response = await fetch(`${LOAD_ENDPOINT}?username=${encodeURIComponent(loggedInUser)}`, { method: 'GET' });
        if (response.status === 404) {
            console.log("No saved state found. Initializing default local state.");
            loadedServerState = { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null };
            score = 0; mistakes = 0; currentSection = 1; currentIndex = 1; updateScoreDisplay(); return false;
        }
        if (!response.ok) { const d = await response.text(); throw new Error(`HTTP ${response.status}: ${d}`); }
        const savedState = await response.json();
        console.log('Saved state loaded:', savedState);
        if (savedState && !savedState.submittedAnswersByPage) savedState.submittedAnswersByPage = {};
        loadedServerState = savedState;
        score = savedState?.score ?? 0; mistakes = savedState?.mistakes ?? 0;
        if (savedState?.currentSection && totalFilesPerSection[savedState.currentSection]) {
             currentSection = savedState.currentSection;
             currentIndex = (savedState.currentIndex >= 1 && savedState.currentIndex <= totalFilesPerSection[currentSection]) ? savedState.currentIndex : 1;
        } else { currentSection = 1; currentIndex = 1; }
        updateScoreDisplay(); return true;
    } catch (error) {
        console.error('Error loading quiz state:', error);
        loadedServerState = { score: 0, mistakes: 0, currentSection: 1, currentIndex: 1, submittedAnswersByPage: {}, lastSaved: null };
        currentSection = 1; currentIndex = 1; score = 0; mistakes = 0; updateScoreDisplay(); return false;
    }
}

// ==========================================
// Quiz Functions (loadQuestions, captureAnswers remain the same)
// ==========================================
async function loadQuestions() {
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) { console.warn("loadQuestions: container missing."); return; }
    const sectionToLoad = currentSection, indexToLoad = currentIndex, pageKey = `${sectionToLoad}-${indexToLoad}`;
    console.log(`Rendering questions for page: ${pageKey}`);
    const answersForThisPage = loadedServerState?.submittedAnswersByPage?.[pageKey];
    const pageWasSubmitted = !!answersForThisPage;
    console.log(`Answers loaded for this page? ${pageWasSubmitted ? 'Yes' : 'No'}`);
    try {
        const response = await fetch(`${sectionToLoad}-${indexToLoad}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status} loading question file`);
        const jsonData = await response.json();
        questionContainer.innerHTML = '';
        jsonData.forEach((item) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'mb-4 p-4 border rounded bg-white shadow-sm question-box';
            const questionId = item.karten_nummer?.toString();
            if (!questionId) { console.warn("Skipping item missing ID:", item); return; }
            questionDiv.dataset.questionId = questionId;
            const questionTitle = document.createElement('h3');
            questionTitle.className = 'text-dark mb-3';
            questionTitle.textContent = `${questionId}. ${item.original_frage || '?'}`;
            questionDiv.appendChild(questionTitle);
            const altQuestion = item.alternativfragen?.find(alt => alt.typ === 'multiple_choice');
            if (altQuestion?.optionen) {
                const optionsDiv = document.createElement('div'); optionsDiv.className = 'mt-2';
                const correctAnswersForThisQ = altQuestion.korrekte_antworten || [];
                Object.entries(altQuestion.optionen).forEach(([key, text], idx) => {
                    const optionId = `q${questionId}-${idx}`;
                    const optionContainer = document.createElement('div'); optionContainer.className = 'form-check mb-2';
                    const input = document.createElement('input'); input.type = 'checkbox'; input.id = optionId; input.name = `question-${questionId}`; input.value = key; input.className = 'form-check-input';
                    input.checked = pageWasSubmitted && answersForThisPage[questionId]?.includes(key);
                    input.disabled = pageWasSubmitted;
                    const label = document.createElement('label'); label.className = 'form-check-label'; label.setAttribute('for', optionId); label.textContent = text || `Opt ${key}`;
                    optionContainer.appendChild(input); optionContainer.appendChild(label); optionsDiv.appendChild(optionContainer);
                });
                questionDiv.appendChild(optionsDiv); questionDiv.dataset.correctAnswers = JSON.stringify(correctAnswersForThisQ);
                 if (pageWasSubmitted && answersForThisPage?.[questionId]) {
                    const submitted = answersForThisPage[questionId]; const isCorrect = arraysEqual(submitted, correctAnswersForThisQ);
                    questionDiv.classList.add(isCorrect ? 'correct-answer' : 'incorrect-answer');
                     if(!isCorrect) {
                         questionDiv.querySelectorAll('.form-check input').forEach(inp => { if (correctAnswersForThisQ.includes(inp.value)) inp.closest('.form-check').classList.add('highlight-correct'); });
                     }
                 }
            } else { questionDiv.appendChild(Object.assign(document.createElement('p'), {textContent:"Keine Multiple-Choice.", className:"text-muted"})); }
            questionContainer.appendChild(questionDiv);
        });
        updateScoreDisplay(); updateButtons();
    } catch (error) {
        console.error(`Error in loadQuestions for ${pageKey}:`, error);
        questionContainer.innerHTML = `<div class="alert alert-danger">Fehler beim Laden: ${error.message}</div>`;
    }
}

function captureAnswers(event) {
    if (event) event.preventDefault();
    console.log("captureAnswers called");
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) return;
    let correctCount = 0, incorrectCount = 0;
    const currentQuestionnaireAnswers = {};
    questionContainer.querySelectorAll('.question-box').forEach((questionDiv) => {
        const questionId = questionDiv.dataset.questionId; if (!questionId) return;
        const correctAnswers = JSON.parse(questionDiv.dataset.correctAnswers || "[]");
        const inputs = questionDiv.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        const selectedAnswers = Array.from(inputs).filter(i => i.checked).map(i => i.value);
        currentQuestionnaireAnswers[questionId] = selectedAnswers;
        questionDiv.classList.remove('correct-answer', 'incorrect-answer'); questionDiv.querySelectorAll('.highlight-correct').forEach(el => el.classList.remove('highlight-correct'));
        const isCorrect = arraysEqual(selectedAnswers, correctAnswers);
        if (isCorrect) { correctCount++; questionDiv.classList.add('correct-answer'); }
        else { incorrectCount++; questionDiv.classList.add('incorrect-answer'); questionDiv.querySelectorAll('.form-check input').forEach(inp => { if (correctAnswers.includes(inp.value)) inp.closest('.form-check').classList.add('highlight-correct'); }); }
        questionDiv.querySelectorAll('input[type="checkbox"]').forEach(i => i.disabled = true);
    });
    console.log('\n--- Submission Complete ---'); score += correctCount; mistakes += incorrectCount;
    console.log(` -> Round: +${correctCount} Correct, +${incorrectCount} Incorrect. || Total: ${score} Correct, ${mistakes} Incorrect.`); updateScoreDisplay();
    document.getElementById('submit-btn')?.setAttribute('disabled', 'true');
    saveQuizStateToBackend(currentQuestionnaireAnswers, false, false, false); // Submit action
}

function updateScoreDisplay() {
    const scoreEl = document.getElementById('score'), mistakesEl = document.getElementById('mistakes');
     if (scoreEl) scoreEl.textContent = `Richtige Antworten: ${score}`;
     if (mistakesEl) mistakesEl.textContent = `Falsche Antworten: ${mistakes}`;
}

async function resetQuestions() {
    console.log("resetQuestions called - Clearing answers for current page & reloading.");
    const pageKey = `${currentSection}-${currentIndex}`;
    if (loadedServerState?.submittedAnswersByPage?.[pageKey]) delete loadedServerState.submittedAnswersByPage[pageKey];
    await saveQuizStateToBackend(null, false, true, false); // Clear current page flag
    loadQuestions();
}

// --- MODIFIED: resetScore function ---
// Resets ONLY the global score/mistakes, leaving answers and location intact.
async function resetScore() { // Make async
     console.log("script.js: resetScore called - Resetting score/mistakes ONLY.");
      score = 0; // Reset locally
      mistakes = 0; // Reset locally

      // Update local state score/mistakes (DON'T clear answers)
      if (loadedServerState) {
          loadedServerState.score = 0;
          loadedServerState.mistakes = 0;
          console.log("Reset score/mistakes in local loadedServerState.")
      } else {
           // Ensure state exists locally even if not loaded
          loadedServerState = { score: 0, mistakes: 0, currentSection: currentSection, currentIndex: currentIndex, submittedAnswersByPage: {}, lastSaved: null };
      }
      updateScoreDisplay(); // Update UI immediately

      // Save state, telling backend to reset ONLY score/mistakes
      await saveQuizStateToBackend(null, false, false, true); // <-- Use the new resetScoreAndMistakesOnly flag

      // No need to reload questions as answers haven't changed
      // loadQuestions(); // Remove or comment out this line
      console.log("Score/Mistakes reset completed.");
}


function nextQuestionnaire() {
     let targetSection = currentSection, targetIndex = currentIndex, canMove = false;
      if (targetIndex < totalFilesPerSection[targetSection]) { targetIndex++; canMove = true; }
      else if (targetSection < Object.keys(totalFilesPerSection).length) { targetSection++; targetIndex = 1; canMove = true; }
      if (canMove) {
          currentSection = targetSection; currentIndex = targetIndex;
          saveQuizStateToBackend(null, false, false, false); // Navigate action
          loadQuestions();
      } else {
          console.log("Already at last questionnaire.");
          const qC = document.getElementById('question-container'); if(qC && !qC.querySelector('.qc-msg')) qC.innerHTML += `<div class="alert alert-success tc mt-4 qc-msg">Alle Fragen abgeschlossen!</div>`;
          document.getElementById('next-btn')?.setAttribute('disabled', 'true');
      }
}

function prevQuestionnaire() {
     let targetSection = currentSection, targetIndex = currentIndex, canMove = false;
      if (targetIndex > 1) { targetIndex--; canMove = true; }
      else if (targetSection > 1) { targetSection--; if (totalFilesPerSection[targetSection]) { targetIndex = totalFilesPerSection[targetSection]; canMove = true; } }
      if (canMove) {
          currentSection = targetSection; currentIndex = targetIndex;
          saveQuizStateToBackend(null, false, false, false); // Navigate action
          loadQuestions();
      } else if (currentSection === 1 && currentIndex === 1) console.log("Already at first questionnaire.");
}

function updateButtons() {
    const prevBtn = document.getElementById('prev-btn'), nextBtn = document.getElementById('next-btn'), submitBtn = document.getElementById('submit-btn'), qC = document.getElementById('question-container');
    if (prevBtn) prevBtn.disabled = (currentSection === 1 && currentIndex === 1);
    let isLast = true; const secs = Object.keys(totalFilesPerSection); if (secs.length > 0 && totalFilesPerSection[currentSection]) { isLast = (currentSection == Math.max(...secs.map(Number)) && currentIndex == totalFilesPerSection[currentSection]); }
    if (nextBtn) nextBtn.disabled = isLast;
    let inputsEnabled = qC?.querySelector('input[type="checkbox"]:not(:disabled)'); if (submitBtn) submitBtn.disabled = !inputsEnabled;
}


async function handleLogout() {
     console.log("handleLogout executing.");
     await saveQuizStateToBackend(null, false, false, false); // Navigate action (save position/score)
     localStorage.removeItem('loggedInUser');
     window.location.href = LOGIN_PAGE;
}

// ==========================================
// Page Initialization Logic (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("--- DOMContentLoaded Fired ---");
    if (!document.getElementById('question-container')) { console.log("Not on quiz page."); return; }
    const user = localStorage.getItem('loggedInUser'); if (!user) { window.location.href = LOGIN_PAGE; return; }
    console.log(`User "${user}" logged in. Initializing quiz.`);
    const ws = document.getElementById('welcome-section'), wm = document.getElementById('welcome-message'), qs = document.getElementById('questionnaire-section'), lo = document.getElementById('logout-btn');
    if (ws) ws.style.display = 'flex'; if (wm) wm.textContent = `Willkommen, ${user}!`; if (qs) qs.style.display = 'block';
    if (lo && !lo.dataset.listenerAttached) { lo.addEventListener('click', handleLogout); lo.dataset.listenerAttached = 'true'; }
    document.getElementById('submit-btn')?.addEventListener('click', captureAnswers); document.getElementById('next-btn')?.addEventListener('click', nextQuestionnaire); document.getElementById('prev-btn')?.addEventListener('click', prevQuestionnaire); document.getElementById('reset-questions-btn')?.addEventListener('click', resetQuestions); document.getElementById('reset-score-btn')?.addEventListener('click', resetScore);
    await loadQuizStateFromBackend();
    console.log(`State after load: S=${currentSection}, I=${currentIndex}, Score=${score}`);
    loadQuestions();
    console.log("--- DOMContentLoaded processing finished ---");
});

console.log("--- script.js (Quiz Logic) Parsed ---");