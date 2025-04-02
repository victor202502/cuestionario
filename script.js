console.log("--- script.js (Quiz Logic) Loaded ---");

// ==========================================
// Global Variables & Constants (Quiz Specific)
// ==========================================
let currentSection = 1;
let currentIndex = 1;
const totalFilesPerSection = { 1: 5, 2: 5, 3: 5, 4: 6 };
let score = 0;
let mistakes = 0;
// Constants needed for redirection FROM quiz page
const LOGIN_PAGE = 'login.html';
const QUIZ_PAGE = 'quiz.html'; // May not be needed here but doesn't hurt

// ==========================================
// Utility Functions (If needed by quiz)
// ==========================================
function arraysEqual(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) {
        return false;
    }
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

// ==========================================
// Quiz Functions
// ==========================================
async function loadQuestions() {
    const questionContainer = document.getElementById('question-container');
    console.log("script.js: loadQuestions attempting to run.");
    if (!questionContainer) {
         console.warn("script.js: loadQuestions - questionContainer not found.");
         return;
    }
    try {
        // Authentication check happens in DOMContentLoaded now
        const loggedInUser = localStorage.getItem('loggedInUser'); // Still good to know who is asking
        console.log(`script.js: loadQuestions - Loading ${currentSection}-${currentIndex}.json for user ${loggedInUser}`);
        const response = await fetch(`${currentSection}-${currentIndex}.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const jsonData = await response.json();

        questionContainer.innerHTML = ''; // Clear previous

        jsonData.forEach((item) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'mb-4 p-4 border rounded bg-white shadow-sm question-box';

            const questionTitle = document.createElement('h3');
            questionTitle.className = 'text-dark mb-3';
            questionTitle.textContent = `${item.karten_nummer}. ${item.original_frage}`;
            questionDiv.appendChild(questionTitle);

            const altQuestion = item.alternativfragen?.find(alt => alt.typ === 'multiple_choice');
            if (altQuestion) {
                const optionsDiv = document.createElement('div');
                optionsDiv.className = 'mt-2';

                Object.entries(altQuestion.optionen).forEach(([key, text], idx) => {
                    const optionId = `q${item.karten_nummer}-${idx}`;
                    const optionContainer = document.createElement('div');
                    optionContainer.className = 'form-check mb-2';

                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.id = optionId;
                    input.name = `question-${item.karten_nummer}`;
                    input.value = key;
                    input.className = 'form-check-input';
                    input.disabled = false;

                    const label = document.createElement('label');
                    label.className = 'form-check-label';
                    label.setAttribute('for', optionId);
                    label.textContent = text;

                    optionContainer.appendChild(input);
                    optionContainer.appendChild(label);
                    optionsDiv.appendChild(optionContainer);
                });
                questionDiv.appendChild(optionsDiv);
                questionDiv.dataset.correctAnswers = JSON.stringify(altQuestion.korrekte_antworten || []);
            }
            questionContainer.appendChild(questionDiv);
        });
        updateScoreDisplay();
        updateButtons();
    } catch (error) {
        console.error('script.js: Error loading questions JSON:', error);
        if(questionContainer) questionContainer.innerHTML = `<div class="alert alert-danger">Error al cargar preguntas. ${error.message}</div>`;
    }
}

function captureAnswers() {
    console.log("script.js: captureAnswers called");
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) return;
    let correctCount = 0;
    let incorrectCount = 0;

    questionContainer.querySelectorAll('.question-box').forEach(questionDiv => {
        const correctAnswers = JSON.parse(questionDiv.dataset.correctAnswers || "[]");
        const inputs = questionDiv.querySelectorAll('input[type="checkbox"]');
        const selectedAnswers = Array.from(inputs).filter(input => input.checked).map(input => input.value);

        questionDiv.classList.remove('correct-answer', 'incorrect-answer');
        questionDiv.querySelectorAll('.form-check').forEach(oc => oc.classList.remove('highlight-correct'));

        const isCorrect = arraysEqual(selectedAnswers, correctAnswers);

        if (isCorrect) {
          correctCount++;
          questionDiv.classList.add('correct-answer');
        } else {
          incorrectCount++;
          questionDiv.classList.add('incorrect-answer');
          questionDiv.querySelectorAll('.form-check').forEach(optionContainer => {
            const input = optionContainer.querySelector('input');
            if (input && correctAnswers.includes(input.value)) {
              optionContainer.classList.add('highlight-correct');
            }
          });
        }
        inputs.forEach(input => input.disabled = true);
    });

    score += correctCount;
    mistakes += incorrectCount;
    updateScoreDisplay();
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.disabled = true;
}

function updateScoreDisplay() {
    // console.log("script.js: updateScoreDisplay called");
    const scoreDisplay = document.getElementById('score');
    const mistakesDisplay = document.getElementById('mistakes');
     if (scoreDisplay) scoreDisplay.textContent = `Aciertos: ${score}`;
     if (mistakesDisplay) mistakesDisplay.textContent = `Fallos: ${mistakes}`;
}

function resetQuestions() {
    console.log("script.js: resetQuestions called");
    // Reset score for the current set? Or just reload visuals?
    // Assuming just reload visuals/enable inputs:
    loadQuestions();
}

function resetScore() {
     console.log("script.js: resetScore called");
      score = 0;
      mistakes = 0;
      updateScoreDisplay();
      // Maybe also reset current question visuals?
      // loadQuestions(); // Uncomment if you want reset score to also reset questions
}

function nextQuestionnaire() {
     console.log("script.js: nextQuestionnaire called");
      if (currentIndex < totalFilesPerSection[currentSection]) {
        currentIndex++;
      } else if (currentSection < Object.keys(totalFilesPerSection).length) {
        currentSection++;
        currentIndex = 1;
      } else {
          console.log("script.js: Already at the last question.");
          // Maybe display a "Quiz Finished" message?
          const qContainer = document.getElementById('question-container');
          if(qContainer) qContainer.innerHTML += `<div class="alert alert-success text-center mt-4">¡Has completado todas las preguntas!</div>`;
          const nextBtn = document.getElementById('next-btn');
          if(nextBtn) nextBtn.disabled = true; // Ensure next is disabled
          return;
      }
      loadQuestions();
}

function prevQuestionnaire() {
     console.log("script.js: prevQuestionnaire called");
      if (currentIndex > 1) {
        currentIndex--;
      } else if (currentSection > 1) {
        currentSection--;
        currentIndex = totalFilesPerSection[currentSection];
      } else {
           console.log("script.js: Already at the first question.");
          return;
      }
      loadQuestions();
}

function updateButtons() {
    // console.log("script.js: updateButtons called");
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

      if (prevBtn) prevBtn.disabled = currentSection === 1 && currentIndex === 1;
      if (totalFilesPerSection && Object.keys(totalFilesPerSection).length > 0) {
            const sections = Object.keys(totalFilesPerSection).map(Number);
            if (sections.length > 0) {
                const maxSection = Math.max(...sections);
                 if (nextBtn) nextBtn.disabled = currentSection === maxSection && currentIndex === totalFilesPerSection[maxSection];
            } else if (nextBtn) {
                nextBtn.disabled = true;
            }
      } else if (nextBtn) {
           nextBtn.disabled = true;
      }

      // Re-enable submit button IF questions are present (check needed?)
      const questionContainer = document.getElementById('question-container');
      if (submitBtn && questionContainer && questionContainer.hasChildNodes()) {
           submitBtn.disabled = false;
      } else if(submitBtn) {
           submitBtn.disabled = true;
      }
}

// ==========================================
// Logout Function (Needed on Quiz Page)
// ==========================================
function handleLogout() {
     console.log("script.js: handleLogout executing.");
    localStorage.removeItem('loggedInUser'); // Remove user session
    console.log("script.js: User removed from localStorage. Redirecting to login page...");
    window.location.href = LOGIN_PAGE; // Redirect to login page
}

// ==========================================
// Page Initialization Logic (FOR QUIZ PAGE ONLY)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- script.js: DOMContentLoaded Fired ---");

    // Check if this script is running on the quiz page
    const quizContainer = document.getElementById('question-container');
    if (!quizContainer) {
        console.log("script.js: Not on quiz page (no question container found). Exiting init.");
        return; // Don't run quiz page logic if not on quiz page
    }
     console.log("script.js: Executing quiz page logic.");

    const loggedInUser = localStorage.getItem('loggedInUser');
    // console.log("script.js: User in localStorage:", loggedInUser); // Optional

    if (!loggedInUser) {
        // If not logged in, redirect immediately
        console.log("script.js: User not logged in, REDIRECTING to login page...");
        window.location.href = LOGIN_PAGE;
        return; // Stop setup
    }

    // --- Setup quiz page for logged in user ---
    console.log(`script.js: Setting up quiz page for user: ${loggedInUser}`);
    const welcomeSectionEl = document.getElementById('welcome-section');
    const welcomeMessageEl = document.getElementById('welcome-message');
    const questionnaireSectionEl = document.getElementById('questionnaire-section');
    const logoutBtnEl = document.getElementById('logout-btn');

    // Display welcome and quiz sections
    if (welcomeSectionEl) welcomeSectionEl.style.display = 'flex'; else console.warn("script.js: welcome-section not found");
    if (welcomeMessageEl) welcomeMessageEl.textContent = `¡Willkommen, ${loggedInUser}!`; else console.warn("script.js: welcome-message not found");
    if (questionnaireSectionEl) questionnaireSectionEl.style.display = 'block'; else console.warn("script.js: questionnaire-section not found");

    // Attach logout listener
    if (logoutBtnEl && !logoutBtnEl.dataset.listenerAttached) {
         console.log("script.js: Attaching listener to logout button.");
         logoutBtnEl.addEventListener('click', handleLogout);
         logoutBtnEl.dataset.listenerAttached = 'true';
    } else if(logoutBtnEl) { console.warn("script.js: Logout listener already attached or button missing."); }
    else { console.warn("script.js: logout-btn not found"); }

    // Attach quiz action listeners
    console.log("script.js: Attaching quiz action listeners.");
    const submitBtnEl = document.getElementById('submit-btn');
    const nextBtnEl = document.getElementById('next-btn');
    const prevBtnEl = document.getElementById('prev-btn');
    const resetQuestionsBtnEl = document.getElementById('reset-questions-btn');
    const resetScoreBtnEl = document.getElementById('reset-score-btn');

    // No need for flags here typically unless DOM reloads strangely
    if (submitBtnEl) submitBtnEl.addEventListener('click', captureAnswers); else console.warn("script.js: submit-btn not found");
    if (nextBtnEl) nextBtnEl.addEventListener('click', nextQuestionnaire); else console.warn("script.js: next-btn not found");
    if (prevBtnEl) prevBtnEl.addEventListener('click', prevQuestionnaire); else console.warn("script.js: prev-btn not found");
    if (resetQuestionsBtnEl) resetQuestionsBtnEl.addEventListener('click', resetQuestions); else console.warn("script.js: reset-questions-btn not found");
    if (resetScoreBtnEl) resetScoreBtnEl.addEventListener('click', resetScore); else console.warn("script.js: reset-score-btn not found");

    // Load initial questions
    console.log("script.js: Calling loadQuestions for initial load.");
    loadQuestions();

    console.log("--- script.js: DOMContentLoaded processing finished ---");
});

console.log("--- script.js (Quiz Logic) Parsed ---");