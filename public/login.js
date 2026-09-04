// public/login.js (MODIFICADO)
console.log("--- login.js Loaded ---");

// ==========================================
// Konstanten
// ==========================================
// Wir benötigen keine explizite BACKEND_URL mehr, da wir relative Routen verwenden.
// const BACKEND_URL = 'http://localhost:3000';
const LOGIN_PAGE_PATH = '/'; // Pfad zur Login-Seite (jetzt index.html im Root)
const QUIZ_PAGE_PATH = '/quiz.html'; // Pfad zur Quiz-Seite

// ==========================================
// Authentifizierungsfunktionen
// ==========================================
function setFieldState(input, isValid) {
    if (!input) return;
    input.classList.remove('is-invalid', 'is-valid');
    if (input.value.trim() === '') {
        input.classList.add('is-invalid');
        return false;
    }
    input.classList.add(isValid ? 'is-valid' : 'is-invalid');
    return isValid;
}

function setMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = `mt-3 ${type} show`;
}

function validateLoginForm() {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const usernameValid = !!usernameInput && setFieldState(usernameInput, usernameInput.value.trim().length > 0);
    const passwordValid = !!passwordInput && setFieldState(passwordInput, passwordInput.value.trim().length >= 1);
    return usernameValid && passwordValid;
}

function validateRegisterForm() {
    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    const usernameValid = !!usernameInput && setFieldState(usernameInput, usernameInput.value.trim().length > 0);
    const passwordValid = !!passwordInput && setFieldState(passwordInput, passwordInput.value.trim().length >= 6);
    return usernameValid && passwordValid;
}

async function handleRegister(event) {
    console.log("handleRegister: Event listener triggered.");
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    } else { console.error("handleRegister: Invalid event object!"); return; }

    const currentRegisterForm = document.getElementById('register-form');
    const currentRegisterMessage = document.getElementById('register-message');
    if (!currentRegisterForm || !currentRegisterMessage) { console.error("Register form/message missing."); return; }
    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    if (!usernameInput || !passwordInput) { console.error("Register inputs missing."); return; }

    if (!validateRegisterForm()) {
        setMessage(currentRegisterMessage, 'Bitte fülle alle Felder korrekt aus.', 'text-danger');
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    console.log("handleRegister: Attempting registration for", username);
    setMessage(currentRegisterMessage, 'Registrierung läuft...', 'text-info');
    try {
        const response = await fetch(`/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok) {
            setMessage(currentRegisterMessage, result.message + " Du kannst dich jetzt anmelden.", 'text-success');
            currentRegisterForm.reset();
            document.querySelectorAll('#register-form .form-control').forEach((field) => field.classList.remove('is-valid', 'is-invalid'));
        } else {
            setMessage(currentRegisterMessage, `Fehler: ${result.message || 'Unbekannter Fehler'}`, 'text-danger');
        }
    } catch (error) {
        console.error('Register Fetch Error:', error);
        setMessage(currentRegisterMessage, 'Verbindungsfehler beim Registrieren.', 'text-danger');
    }
}

async function handleLogin(event) {
    console.log("handleLogin: Event listener triggered.");
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    } else { console.error("handleLogin: Invalid event object!"); return; }

    const currentLoginForm = document.getElementById('login-form');
    const currentLoginMessage = document.getElementById('login-message');
     if (!currentLoginForm || !currentLoginMessage) { console.error("Login form/message missing."); return; }
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
     if (!usernameInput || !passwordInput) { console.error("Login inputs missing."); return; }

    if (!validateLoginForm()) {
        setMessage(currentLoginMessage, 'Bitte Benutzername und Passwort eingeben.', 'text-danger');
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    console.log("handleLogin: Attempting login for", username);
    setMessage(currentLoginMessage, 'Anmeldung läuft...', 'text-info');
    try {
        // --- URL Relativa ---
        const response = await fetch(`/login`, { // Cambiado
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const contentType = response.headers.get("content-type");

        if (response.ok && contentType && contentType.includes("application/json")) {
             const result = await response.json();
             if (result.username) {
                 localStorage.setItem('loggedInUser', result.username);
                 console.log("Stored user:", result.username);
                 console.log("Attempting REDIRECT to quiz page:", QUIZ_PAGE_PATH);
                 // --- Redirección Relativa ---
                 window.location.href = QUIZ_PAGE_PATH; // Cambiado
                 return;
             } else {
                 console.error("Username missing in login response.");
                 currentLoginMessage.textContent = 'Fehler: Ungültige Antwort.';
                 currentLoginMessage.className = 'mt-3 text-danger';
             }
        } else if (!response.ok) {
             let errorMsg = 'Benutzername oder Passwort falsch.';
             // Intenta parsear JSON incluso si no es OK, backend podría enviar {message: ...} con 401/409 etc.
             if (contentType && contentType.includes("application/json")) {
                 try { const errRes = await response.json(); errorMsg = errRes.message || errorMsg; }
                 catch(e){ console.warn("Could not parse JSON error response although Content-Type was JSON."); }
             } else { console.warn("Login failed response is not JSON. Status:", response.status); }
             console.warn("Login failed:", errorMsg);
             currentLoginMessage.textContent = `Fehler: ${errorMsg}`;
             currentLoginMessage.className = 'mt-3 text-danger';
        } else {
             console.error("Login OK but response not JSON?");
             currentLoginMessage.textContent = 'Fehler: Unerwartete Antwort.';
             currentLoginMessage.className = 'mt-3 text-danger';
        }
     } catch (error) {
        console.error('Login Fetch Error:', error);
        currentLoginMessage.textContent = 'Verbindungsfehler beim Anmelden.';
        currentLoginMessage.className = 'mt-3 text-danger';
     }
}

// ==========================================
// Initialisierungslogik der Seite
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- login.js: DOMContentLoaded Fired ---");

    const loginFormEl = document.getElementById('login-form');
    const registerFormEl = document.getElementById('register-form');
    const demoLoginButton = document.getElementById('demo-login-btn');
    if (!loginFormEl || !registerFormEl) {
        console.log("login.js: No auth forms found on this page. Exiting init.");
        return;
    }
    console.log("login.js: Executing login page specific logic.");

    const loggedInUser = localStorage.getItem('loggedInUser');
    console.log("login.js: User in localStorage:", loggedInUser);

    if (loggedInUser) {
        console.log("login.js: User is already logged in, redirecting to quiz page:", QUIZ_PAGE_PATH);
        window.location.href = QUIZ_PAGE_PATH;
        return;
    }

    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const allInputs = document.querySelectorAll('.form-control');

    function setActiveAuthView(view) {
        authTabs.forEach((tab) => {
            const isActive = tab.dataset.authTab === view;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });

        authForms.forEach((form) => {
            const isActive = form.id === `${view}-panel`;
            form.classList.toggle('active', isActive);
        });
    }

    function bindInputValidation() {
        allInputs.forEach((input) => {
            input.addEventListener('input', () => {
                if (input.id === 'login-username' || input.id === 'reg-username') {
                    setFieldState(input, input.value.trim().length > 0);
                }
                if (input.id === 'login-password') {
                    setFieldState(input, input.value.trim().length >= 1);
                }
                if (input.id === 'reg-password') {
                    setFieldState(input, input.value.trim().length >= 6);
                }
            });
        });
    }

    function bindPasswordToggles() {
        document.querySelectorAll('.password-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const targetInput = document.getElementById(targetId);
                if (!targetInput) return;
                const isPassword = targetInput.type === 'password';
                targetInput.type = isPassword ? 'text' : 'password';
                button.textContent = isPassword ? 'Verbergen' : 'Anzeigen';
            });
        });
    }

    authTabs.forEach((tab) => {
        tab.addEventListener('click', () => setActiveAuthView(tab.dataset.authTab));
    });

    bindInputValidation();
    bindPasswordToggles();

    if (registerFormEl && !registerFormEl.dataset.listenerAttached) {
        console.log("login.js: Attaching listener to register form.");
        registerFormEl.addEventListener('submit', handleRegister);
        registerFormEl.dataset.listenerAttached = 'true';
    }

    if (!loginFormEl.dataset.listenerAttached) {
        console.log("login.js: Attaching listener to login form.");
        loginFormEl.addEventListener('submit', handleLogin);
        loginFormEl.dataset.listenerAttached = 'true';
    }

    if (demoLoginButton) {
        demoLoginButton.addEventListener('click', () => {
            document.getElementById('login-username').value = 'test';
            document.getElementById('login-password').value = 'test1234';
            loginFormEl.requestSubmit();
        });
    }

    setActiveAuthView('login');

    console.log("--- login.js: DOMContentLoaded processing finished ---");
});

console.log("--- login.js Parsed ---");