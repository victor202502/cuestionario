console.log("--- login.js Loaded ---");

// ==========================================
// Constants (Specific to login/auth flow)
// ==========================================
const BACKEND_URL = 'http://localhost:3000';
const LOGIN_PAGE = 'login.html'; // May not be needed here, but good for consistency
const QUIZ_PAGE = 'quiz.html';

// ==========================================
// Authentication Functions (Needed on login page)
// ==========================================
async function handleRegister(event) {
    console.log("handleRegister: Event listener triggered.");
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    } else { console.error("handleRegister: Invalid event object!"); return; }

    // Get elements specific to this function's scope
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
        const response = await fetch(`${BACKEND_URL}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const result = await response.json();
        if (response.ok) {
            currentRegisterMessage.textContent = result.message + " Ahora puedes iniciar sesión.";
            currentRegisterMessage.className = 'mt-3 text-success';
            currentRegisterForm.reset();
        } else {
            currentRegisterMessage.textContent = `Error: ${result.message}`;
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

    // Get elements specific to this function's scope
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
        const response = await fetch(`${BACKEND_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const contentType = response.headers.get("content-type");

        if (response.ok && contentType && contentType.includes("application/json")) {
             const result = await response.json();
             if (result.username) {
                 // *** KEY ACTION: Store user and REDIRECT ***
                 localStorage.setItem('loggedInUser', result.username);
                 console.log("Stored user:", result.username);
                 console.log("Attempting REDIRECT to quiz page...");
                 window.location.href = QUIZ_PAGE; // Redirect on success
                 return; // Stop further script execution after redirect command
             } else {
                 console.error("Username missing in login response.");
                 currentLoginMessage.textContent = 'Error: Respuesta inválida.';
                 currentLoginMessage.className = 'mt-3 text-danger';
             }
        } else if (!response.ok) {
             let errorMsg = 'Usuario o contraseña incorrectos.';
             if (contentType && contentType.includes("application/json")) {
                 try { const errRes = await response.json(); errorMsg = errRes.message || errorMsg; } catch(e){ console.warn("Could not parse JSON error response.");}
             } else { console.warn("Login failed response is not JSON."); }
             console.warn("Login failed:", errorMsg);
             currentLoginMessage.textContent = `Error: ${errorMsg}`;
             currentLoginMessage.className = 'mt-3 text-danger';
        } else {
             console.error("Login OK but response not JSON.");
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
// Page Initialization Logic (FOR LOGIN PAGE ONLY)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- login.js: DOMContentLoaded Fired ---");

    // Check if this script is running on the login page
    const loginFormEl = document.getElementById('login-form');
    if (!loginFormEl) {
        console.log("login.js: Not on login page (no login form found). Exiting init.");
        return; // Don't run login page logic if not on login page
    }
    console.log("login.js: Executing login page logic.");

    const loggedInUser = localStorage.getItem('loggedInUser');
    console.log("login.js: User in localStorage:", loggedInUser);

    if (loggedInUser) {
        // If already logged in, redirect immediately
        console.log("login.js: User is logged in, attempting auto-redirect to quiz...");
        window.location.href = QUIZ_PAGE;
        return; // Stop processing this page
    } else {
        // Only attach listeners if *not* already logged in
        const registerFormEl = document.getElementById('register-form');

        if (registerFormEl && !registerFormEl.dataset.listenerAttached) {
            console.log("login.js: Attaching listener to register form.");
            registerFormEl.addEventListener('submit', handleRegister);
            registerFormEl.dataset.listenerAttached = 'true';
        } else if (registerFormEl) { console.warn("login.js: Register listener already attached or form missing."); }
        else { console.warn("login.js: Register form element NOT found!"); }


        if (loginFormEl && !loginFormEl.dataset.listenerAttached) {
            console.log("login.js: Attaching listener to login form.");
            loginFormEl.addEventListener('submit', handleLogin);
            loginFormEl.dataset.listenerAttached = 'true';
        } else if (loginFormEl) { console.warn("login.js: Login listener already attached or form missing."); }
        // No need for 'else' here as we checked loginFormEl at the start
    }

    console.log("--- login.js: DOMContentLoaded processing finished ---");
});

console.log("--- login.js Parsed ---");