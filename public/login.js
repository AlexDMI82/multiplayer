
// Check authentication status and redirect if needed
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
        try {
            const userData = JSON.parse(userStr);
            const currentPath = window.location.pathname;
            
            // If already logged in and on login/register page
            if (currentPath === '/login.html' || currentPath === '/register.html') {
                // If user has selected a character, go to lobby
                if (userData.characterClass) {
                    window.location.href = '/index.html';
                } else {
                    // If user hasn't selected a character, go to character selection
                    window.location.href = '/character-select.html';
                }
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
}

// Helper function to show error messages
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Check auth status first
    checkAuthStatus();
    
    // Set up login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Validate input
            if (!username || !password) {
                showError('login-error', 'Please enter both username and password');
                return;
            }
            
            // Show loading state
            const loginButton = loginForm.querySelector('button[type="submit"]');
            if (loginButton) {
                loginButton.disabled = true;
                loginButton.textContent = 'Logging in...';
            }
            
            // Send login request
            fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Login failed');
                }
                return response.json();
            })
            .then(data => {
                // Store authentication data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Check if user has selected a character class
                if (data.user.characterClass) {
                    // User already has a character, redirect to lobby
                    window.location.href = '/index.html';
                } else {
                    // User needs to select a character, redirect to character selection
                    window.location.href = '/character-select.html';
                }
            })
            .catch(error => {
                console.error('Error during login:', error);
                showError('login-error', 'Invalid username or password');
                
                // Reset button state
                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Login';
                }
            });
        });
    }
    
    // Set up registration form handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email') ? document.getElementById('register-email').value : '';
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Validate input
            if (!username || !password) {
                showError('register-error', 'Please enter both username and password');
                return;
            }
            
            if (password !== confirmPassword) {
                showError('register-error', 'Passwords do not match');
                return;
            }
            
            // Show loading state
            const registerButton = registerForm.querySelector('button[type="submit"]');
            if (registerButton) {
                registerButton.disabled = true;
                registerButton.textContent = 'Creating account...';
            }
            
            // Prepare registration data
            const registrationData = {
                username,
                password
            };
            
            // Add email if it exists
            if (email) {
                registrationData.email = email;
            }
            
            // Send registration request
            fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registrationData)
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 409) {
                        throw new Error('Username already exists');
                    }
                    throw new Error('Registration failed');
                }
                return response.json();
            })
            .then(data => {
                // Store authentication data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // After registration, always redirect to character selection
                window.location.href = '/character-select.html';
            })
            .catch(error => {
                console.error('Error during registration:', error);
                showError('register-error', error.message || 'Registration failed');
                
                // Reset button state
                if (registerButton) {
                    registerButton.disabled = false;
                    registerButton.textContent = 'Register';
                }
            });
        });
    }
});