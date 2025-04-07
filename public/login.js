// public/login.js (MODIFICADO)
console.log("--- login.js Loaded ---");

// ==========================================
// Constants
// ==========================================
// Ya no necesitamos BACKEND_URL explícito, usaremos rutas relativas
// const BACKEND_URL = 'http://localhost:3000';
const LOGIN_PAGE_PATH = '/'; // Ruta a la página de login (ahora index.html en la raíz)
const QUIZ_PAGE_PATH = '/quiz.html'; // Ruta a la página del quiz

// ==========================================
// Authentication Functions
// ==========================================
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

    const username = usernameInput.value;
    const password = passwordInput.value;
    console.log("handleRegister: Attempting registration for", username);
    currentRegisterMessage.textContent = 'Registrando...';
    currentRegisterMessage.className = 'mt-3 text-info';
    try {
        // --- URL Relativa ---
        const response = await fetch(`/register`, { // Cambiado
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json(); // Asume que siempre es JSON (ajusta si no)
        if (response.ok) {
            currentRegisterMessage.textContent = result.message + " Ahora puedes iniciar sesión.";
            currentRegisterMessage.className = 'mt-3 text-success';
            currentRegisterForm.reset();
        } else {
            currentRegisterMessage.textContent = `Error: ${result.message || 'Error desconocido'}`;
            currentRegisterMessage.className = 'mt-3 text-danger';
        }
    } catch (error) {
        console.error('Register Fetch Error:', error);
        currentRegisterMessage.textContent = 'Error de conexión al registrar.';
        currentRegisterMessage.className = 'mt-3 text-danger';
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

    const username = usernameInput.value;
    const password = passwordInput.value;
    console.log("handleLogin: Attempting login for", username);
    currentLoginMessage.textContent = 'Iniciando sesión...';
    currentLoginMessage.className = 'mt-3 text-info';
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
                 currentLoginMessage.textContent = 'Error: Respuesta inválida.';
                 currentLoginMessage.className = 'mt-3 text-danger';
             }
        } else if (!response.ok) {
             let errorMsg = 'Usuario o contraseña incorrectos.';
             // Intenta parsear JSON incluso si no es OK, backend podría enviar {message: ...} con 401/409 etc.
             if (contentType && contentType.includes("application/json")) {
                 try { const errRes = await response.json(); errorMsg = errRes.message || errorMsg; }
                 catch(e){ console.warn("Could not parse JSON error response although Content-Type was JSON."); }
             } else { console.warn("Login failed response is not JSON. Status:", response.status); }
             console.warn("Login failed:", errorMsg);
             currentLoginMessage.textContent = `Error: ${errorMsg}`;
             currentLoginMessage.className = 'mt-3 text-danger';
        } else {
             console.error("Login OK but response not JSON?");
             currentLoginMessage.textContent = 'Error: Respuesta inesperada.';
             currentLoginMessage.className = 'mt-3 text-danger';
        }
     } catch (error) {
        console.error('Login Fetch Error:', error);
        currentLoginMessage.textContent = 'Error de conexión al iniciar sesión.';
        currentLoginMessage.className = 'mt-3 text-danger';
     }
}

// ==========================================
// Page Initialization Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- login.js: DOMContentLoaded Fired ---");

    const loginFormEl = document.getElementById('login-form');
    if (!loginFormEl) {
        // Si login.js se carga en otra página por error, no hagas nada.
        // Esto es más robusto que comprobar la URL actual.
        console.log("login.js: No login form found on this page. Exiting init.");
        return;
    }
    console.log("login.js: Executing login page specific logic.");

    const loggedInUser = localStorage.getItem('loggedInUser');
    console.log("login.js: User in localStorage:", loggedInUser);

    if (loggedInUser) {
        console.log("login.js: User is already logged in, redirecting to quiz page:", QUIZ_PAGE_PATH);
        window.location.href = QUIZ_PAGE_PATH; // Cambiado
        return;
    } else {
        // Attach listeners only if not logged in
        const registerFormEl = document.getElementById('register-form');

        if (registerFormEl && !registerFormEl.dataset.listenerAttached) {
            console.log("login.js: Attaching listener to register form.");
            registerFormEl.addEventListener('submit', handleRegister);
            registerFormEl.dataset.listenerAttached = 'true';
        } else if (!registerFormEl) {
             console.warn("login.js: Register form element NOT found!");
        }

        // loginFormEl ya sabemos que existe por la comprobación inicial
        if (!loginFormEl.dataset.listenerAttached) {
            console.log("login.js: Attaching listener to login form.");
            loginFormEl.addEventListener('submit', handleLogin);
            loginFormEl.dataset.listenerAttached = 'true';
        }
    }

    console.log("--- login.js: DOMContentLoaded processing finished ---");
});

console.log("--- login.js Parsed ---");