
// Check if user is logged in
function isLoggedIn() {
  return !!localStorage.getItem('token');
}

// Redirect to login page if not logged in, or character select if needed
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  
  // Check if user has selected a character class
  const user = getCurrentUser();
  if (user && !user.characterClass) {
    // User is logged in but hasn't selected a character
    window.location.href = '/character-select.html';
    return false;
  }
  
  return true;
}

// Redirect to appropriate page based on auth status
function checkAuthRedirect() {
  if (!isLoggedIn()) {
    // Not logged in, stay on login/register page
    return;
  }
  
  const user = getCurrentUser();
  const currentPath = window.location.pathname;
  
  // If on login or register page but already logged in
  if (currentPath === '/login.html' || currentPath === '/register.html') {
    if (user && user.characterClass) {
      // User has selected character, go to lobby
      window.location.href = '/index.html';
    } else {
      // User needs to select character
      window.location.href = '/character-select.html';
    }
  }
  
  // If on character select page but already has character
  if (currentPath === '/character-select.html' && user && user.characterClass) {
    window.location.href = '/index.html';
  }
  
  // If on main game page but hasn't selected character
  if (currentPath === '/index.html' && user && !user.characterClass) {
    window.location.href = '/character-select.html';
  }
}

// Get user data from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (e) {
    console.error('Error parsing user data', e);
    localStorage.removeItem('user'); // Remove corrupted data
    return null;
  }
}

// Get auth token
function getToken() {
  return localStorage.getItem('token');
}

// Log out user
async function logout() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pendingGameId'); // Clear pending game on logout
    
    // Redirect to login
    window.location.href = '/login.html';
  }
}

// Add auth headers to fetch request
function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) return fetch(url, options);
  
  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  };
  
  return fetch(url, authOptions)
    .then(response => {
      // If we get a 401 Unauthorized, clear tokens and redirect to login
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        throw new Error('Authentication failed');
      }
      return response;
    });
}

// Connect socket.io with auth
function connectAuthSocket(socket) {
  const token = getToken();
  if (token) {
    // Set auth token in socket handshake
    socket.auth = { token };
    socket.connect();
    
    // Send auth after connection
    socket.on('connect', () => {
      socket.emit('authenticate', token);
    });
    
    socket.on('authenticated', (data) => {
      // Update local user data with any changes from server
      if (data.user) {
        const currentUser = getCurrentUser();
        if (currentUser) {
          // Merge server data with local data
          const updatedUser = {...currentUser, ...data.user};
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        // Check if user needs character selection after authentication
        if (data.user && !data.user.characterClass) {
          const pendingGameId = localStorage.getItem('pendingGameId');
          
          // Only redirect if not currently in a game
          if (!pendingGameId && window.location.pathname !== '/character-select.html') {
            window.location.href = '/character-select.html';
          }
        }
      }
    });
    
    socket.on('authError', (error) => {
      console.error('Socket authentication error:', error);
      if (error.message === 'Authentication required' || error.message === 'Invalid token') {
        // Token is invalid, log out
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
      }
    });
  }
  
  return socket;
}

// Update user data with character class selection
function updateUserCharacterClass(characterClass, characterBonuses) {
  const userStr = localStorage.getItem('user');
  if (!userStr) return;
  
  try {
    const user = JSON.parse(userStr);
    user.characterClass = characterClass;
    user.characterBonuses = characterBonuses;
    localStorage.setItem('user', JSON.stringify(user));
  } catch (e) {
    console.error('Error updating user character class', e);
  }
}

// Get character bonuses based on character class
function getCharacterBonuses(characterClass) {
  switch(characterClass) {
    case 'shadowsteel':
      return {
        agility: 7,
        strength: 3,
        intuition: 0,
        endurance: 0,
        specialAbility: 'evade'
      };
    case 'ironbound':
      return {
        agility: 0,
        strength: 5,
        intuition: 0,
        endurance: 5,
        specialAbility: 'ignoreBlock'
      };
    case 'flameheart':
      return {
        agility: 0,
        strength: 3,
        intuition: 7,
        endurance: 0,
        specialAbility: 'criticalHit'
      };
    case 'venomfang':
      return {
        agility: 5,
        strength: 5,
        intuition: 0,
        endurance: 0,
        specialAbility: 'poison'
      };
    default:
      return {
        agility: 0,
        strength: 0,
        intuition: 0,
        endurance: 0,
        specialAbility: null
      };
  }
}

// Run auth check on page load
document.addEventListener('DOMContentLoaded', function() {
  checkAuthRedirect();
});