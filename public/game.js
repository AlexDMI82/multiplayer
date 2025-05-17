// Connect to Socket.io server
const socket = io({
    autoConnect: false // Prevent auto-connection, we'll connect after auth
});

// DOM elements - Login
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const shopScreen = document.getElementById('shop-screen');
const usernameInput = document.getElementById('username');
const loginBtn = document.getElementById('login-btn');
const avatarOptions = document.querySelectorAll('.avatar-option');
const logoutBtn = document.getElementById('logout-btn');

// DOM elements - Lobby
const playerAvatar = document.getElementById('player-avatar');
const playerName = document.getElementById('player-name');
const playersContainer = document.getElementById('players-container');
const incomingChallenges = document.getElementById('incoming-challenges');
const outgoingChallenges = document.getElementById('outgoing-challenges');
const profileBtn = document.getElementById('profile-btn'); // Added

// DOM elements - Game
const backToLobbyBtn = document.getElementById('back-to-lobby');
const player1Avatar = document.getElementById('player1-avatar');
const player1Name = document.getElementById('player1-name');
const player2Avatar = document.getElementById('player2-avatar');
const player2Name = document.getElementById('player2-name');
const gameMessage = document.getElementById('game-message');
const combatControls = document.getElementById('combat-controls');
const gameLog = document.getElementById('game-log');
const player1Health = document.getElementById('player1-health');
const player1Energy = document.getElementById('player1-energy');
const player2Health = document.getElementById('player2-health');
const player2Energy = document.getElementById('player2-energy');
const player1WeaponName = document.getElementById('player1-weapon-name');
const player1ArmorName = document.getElementById('player1-armor-name');
const player1ShieldName = document.getElementById('player1-shield-name');
const player1HelmetName = document.getElementById('player1-helmet-name'); // Added for helmet
const player2WeaponName = document.getElementById('player2-weapon-name');
const player2ArmorName = document.getElementById('player2-armor-name');
const player2ShieldName = document.getElementById('player2-shield-name');
const player2HelmetName = document.getElementById('player2-helmet-name'); // Added for helmet
const turnTimerDisplay = document.getElementById('turn-timer');
const confirmMoveBtn = document.getElementById('confirm-move-btn');

// Combat areas
const attackAreas = document.querySelectorAll('.attack-areas .combat-area');
const blockAreas = document.querySelectorAll('.block-areas .combat-area');

// DOM elements - Modal
const challengeModal = document.getElementById('challenge-modal');
const opponentNameSpan = document.getElementById('opponent-name');
const confirmChallengeBtn = document.getElementById('confirm-challenge');
const cancelChallengeBtn = document.getElementById('cancel-challenge');

// DOM elements - Combat Results Modal
const combatResultModal = document.getElementById('combat-result-modal');
const combatResultContent = document.getElementById('combat-result-content');
const continueGameBtn = document.getElementById('continue-game');

// DOM elements - Shop & Inventory
const backToLobbyFromShopBtn = document.getElementById('back-to-lobby-from-shop');
const openShopBtn = document.getElementById('open-shop-btn');
const openInventoryBtn = document.getElementById('open-inventory-btn');
const inventoryModal = document.getElementById('inventory-modal');
const closeInventoryBtn = document.getElementById('close-inventory');
const playerGoldSpan = document.getElementById('player-gold');
const shopItemsContainer = document.getElementById('shop-items-container');
const inventoryItemsContainer = document.getElementById('inventory-items-container');
const equippedWeapon = document.getElementById('equipped-weapon');
const equippedArmor = document.getElementById('equipped-armor');
const equippedShield = document.getElementById('equipped-shield');

// Global state
let currentUser = null;
let selectedAvatar = 'avatar1.png';
let selectedOpponent = null;
let currentGameId = null;
let gameState = null;
let myPlayerId = null;
let opponentId = null;
let waitingForOpponent = false;
let roundInProgress = false;
let shopData = null;
let turnTimer = null;
let turnTimeLeft = 0;
let turnTimerInterval = null;
let selectedAttackArea = null;
let selectedBlockArea = null;
let lastEquippedSlot = null; // Track the last equipped slot for animation

// Helper function to check if player is in battle
function inBattle() {
    // Check if we're in a game screen or if a game is active
    return gameScreen && !gameScreen.classList.contains('hidden') || currentGameId !== null;
}

// Add or modify this function to prevent stats upgrading during battle
function disableStatsButtonsDuringBattle() {
    if (inBattle()) {
        // Disable all stat increase buttons during battle
        const statIncreaseButtons = document.querySelectorAll('.stat-increase');
        statIncreaseButtons.forEach(button => {
            button.disabled = true;
            button.style.display = 'none'; // Hide them completely
        });

        // Add a message to indicate stats can't be changed during battle
        // Check if the message already exists to avoid adding multiple messages
        const statsHeaders = document.querySelectorAll('.stats-header');
        statsHeaders.forEach(header => {
            if (!header.querySelector('.battle-stats-message')) {
                const message = document.createElement('div');
                message.classList.add('battle-stats-message');
                message.textContent = 'Stats cannot be changed during battle';
                message.style.color = '#ff5555';
                message.style.fontSize = '12px';
                message.style.marginTop = '5px';
                header.appendChild(message);
            }
        });
    } else {
        // If not in battle, ensure buttons are enabled and message is removed
        const statIncreaseButtons = document.querySelectorAll('.stat-increase');
        statIncreaseButtons.forEach(button => {
            button.disabled = false;
            button.style.display = ''; // Revert to default display
        });
        
        // Remove battle messages
        const battleMessages = document.querySelectorAll('.battle-stats-message');
        battleMessages.forEach(message => {
            message.remove();
        });
    }
}

// Initialize
function init() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        // Not logged in, check if we're already on the login screen
        if (window.location.pathname !== '/login.html' && window.location.pathname !== '/register.html') {
            window.location.href = '/login.html';
            return;
        }
    } else {
        // User is logged in, check if they have selected a character
        try {
            const userData = JSON.parse(userStr);
            
            // If user doesn't have a character class and not on character select page, redirect
            if (!userData.characterClass && 
                window.location.pathname !== '/character-select.html') {
                console.log('User has no character class, redirecting to character selection');
                window.location.href = '/character-select.html';
                return;
            }
            
            // Initialize the game for users with character class
            setupEventListeners();
            setupEquipmentTooltips();
            setupLobbyEventHandlers();

            // Initialize stats manager if available
            if (window.statsManager) {
                window.statsManager.init();

                // Modify updateStatsUI function of statsManager
                if (typeof window.statsManager.updateStatsUI === 'function') {
                    const originalUpdateStatsUI = window.statsManager.updateStatsUI;
                    window.statsManager.updateStatsUI = function(...args) {
                        // Call the original function
                        originalUpdateStatsUI.apply(this, args);
                        // Disable stat buttons during battle (or re-enable if not in battle)
                        disableStatsButtonsDuringBattle();
                    };
                }
            }

            // If we're on the index page, try to login with stored credentials
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                loginWithStoredCredentials();
            }
        } catch (error) {
            console.error('Error parsing user data', error);
            window.location.href = '/login.html';
        }
    }
}

// Login with stored credentials - MODIFIED
function loginWithStoredCredentials() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const userData = JSON.parse(userStr);
            const pendingGameId = localStorage.getItem('pendingGameId');

            login(userData.username, userData.avatar); // This will call socket.connect()

            // If there's a pending game, restore it after login and authentication
            if (pendingGameId) {
                const rejoinHandler = () => {
                    console.log('Authenticated, attempting to rejoin game:', pendingGameId);
                    socket.emit('rejoinGame', pendingGameId);
                    localStorage.removeItem('pendingGameId');
                    socket.off('authenticated', rejoinHandler); // Clean up listener
                };
                // Listen for 'authenticated' event if not already authenticated
                // If socket is already connected and authenticated (e.g. quick refresh),
                // 'authenticated' might not fire again for this handler.
                // However, 'authenticated' is the most reliable signal.
                socket.on('authenticated', rejoinHandler);
            }
        } catch (error) {
            console.error('Error parsing user data', error);
            window.location.href = '/login.html';
        }
    } else {
        window.location.href = '/login.html';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Avatar selection
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedAvatar = option.getAttribute('data-avatar');
        });
    });

    // Login button
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const username = usernameInput.value.trim();
            if (username) {
                login(username, selectedAvatar);
            } else {
                alert('Please enter a username');
            }
        });
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
        });
    }

    // Profile button
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = '/character-profile.html';
        });
    }

    // Back to lobby button
    if (backToLobbyBtn) {
        backToLobbyBtn.addEventListener('click', () => {
            if (currentGameId) {
                socket.emit('leaveGame', currentGameId);
                currentGameId = null;
                gameState = null;
                stopTurnTimer();
                localStorage.removeItem('pendingGameId'); // Clear pending game on explicit leave
            }
            showScreen(lobbyScreen);
            disableStatsButtonsDuringBattle(); // Re-check stat button state
        });
    }

    // Challenge modal buttons
    if (confirmChallengeBtn) {
        confirmChallengeBtn.addEventListener('click', () => {
            if (selectedOpponent) {
                socket.emit('challengePlayer', selectedOpponent.id);
                hideModal(challengeModal);
            }
        });
    }

    if (cancelChallengeBtn) {
        cancelChallengeBtn.addEventListener('click', () => {
            hideModal(challengeModal);
        });
    }

    // Enter key for login
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });
    }

    // Combat area selection
    attackAreas.forEach(area => {
        area.addEventListener('click', () => {
            attackAreas.forEach(a => a.classList.remove('selected'));
            area.classList.add('selected');
            selectedAttackArea = area.getAttribute('data-area');
            checkConfirmButton();
        });
    });
    
    blockAreas.forEach(area => {
        area.addEventListener('click', () => {
            blockAreas.forEach(a => a.classList.remove('selected'));
            area.classList.add('selected');
            selectedBlockArea = area.getAttribute('data-area');
            checkConfirmButton();
        });
    });
    
    // Confirm move button
    if (confirmMoveBtn) {
        confirmMoveBtn.addEventListener('click', () => {
            makeMove(selectedAttackArea, selectedBlockArea);
        });
    }
    
    // Continue game button in result modal
    if (continueGameBtn) {
        continueGameBtn.addEventListener('click', () => {
            hideModal(combatResultModal);
        });
    }

    // Shop and inventory buttons
    if (openShopBtn) {
        openShopBtn.addEventListener('click', () => {
            socket.emit('getShopItems');
            socket.emit('getInventory');
            showScreen(shopScreen);
        });
    }
    
    if (backToLobbyFromShopBtn) {
        backToLobbyFromShopBtn.addEventListener('click', () => {
            showScreen(lobbyScreen);
        });
    }
    
    if (openInventoryBtn) {
        openInventoryBtn.addEventListener('click', () => {
            socket.emit('getInventory');
            showModal(inventoryModal);
        });
    }
    
    if (closeInventoryBtn) {
        closeInventoryBtn.addEventListener('click', () => {
            hideModal(inventoryModal);
        });
    }
    
    // Shop category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const category = btn.getAttribute('data-category');
            displayShopItems(category);
        });
    });

    // Equipment slot click handlers for opening inventory
    document.querySelectorAll('.equipment-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            if (!inventoryModal) return;
            let slotType = '';
            const classes = Array.from(slot.classList);
            for (const className of classes) {
                if (className.endsWith('-slot') && className !== 'equipment-slot') {
                    slotType = className.replace('-slot', '');
                    break;
                }
            }
            if (slotType === 'left-hand' || slotType === 'right-hand' || slotType === 'sword') {
                slotType = 'weapon';
            }
            openInventoryForSlot(slotType);
        });
    });
}

// Set up event listeners for lobby buttons
function setupLobbyEventHandlers() {
    // View Details button
    const viewDetailsBtn = document.getElementById('player-profile-detail-btn');
    if (viewDetailsBtn) {
        viewDetailsBtn.addEventListener('click', () => {
            window.location.href = '/character-profile.html';
        });
    }
    
    // Find Match button
    const findMatchBtn = document.getElementById('find-match-btn');
    if (findMatchBtn) {
        findMatchBtn.addEventListener('click', () => {
            // Scroll to the player list section
            const playerListContainer = document.querySelector('.player-list-container');
            if (playerListContainer) {
                playerListContainer.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// Setup tooltips for equipment slots
function setupEquipmentTooltips() {
    const equipmentSlots = document.querySelectorAll('.equipment-slot');
    
    equipmentSlots.forEach(slot => {
        slot.addEventListener('mouseenter', () => {
            if (!currentUser) return;
            const tooltip = document.createElement('div');
            tooltip.classList.add('equipment-tooltip');
            const rect = slot.getBoundingClientRect();
            let slotType = '';
            const classes = Array.from(slot.classList);
            for (const className of classes) {
                if (className.endsWith('-slot') && className !== 'equipment-slot') {
                    slotType = className.replace('-slot', '');
                    break;
                }
            }
            if (slotType === 'left-hand' || slotType === 'right-hand' || slotType === 'sword') {
                slotType = 'weapon';
            }
            const nameEl = slot.querySelector('.equipment-name');
            const itemName = nameEl ? nameEl.textContent : 'Empty';
            const isEmpty = itemName === 'None';
            let tooltipContent = '';
            if (isEmpty) {
                tooltipContent = `
                    <div class="tooltip-title">${slotType.charAt(0).toUpperCase() + slotType.slice(1)} Slot</div>
                    <div class="tooltip-description">No item equipped</div>
                `;
            } else {
                const qualityClass = Array.from(slot.classList)
                    .find(c => ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(c)) || 'common';
                const stats = nameEl && nameEl.title ? (nameEl.title.split(': ')[1] || '') : '';
                tooltipContent = `
                    <div class="tooltip-title ${qualityClass}">${itemName}</div>
                    <div class="tooltip-stats">${stats}</div>
                `;
            }
            tooltip.innerHTML = tooltipContent;
            if (rect.left < window.innerWidth / 2) {
                tooltip.style.left = `${rect.right + 10}px`;
                tooltip.style.top = `${rect.top + rect.height / 2 - 20}px`;
            } else {
                tooltip.style.left = `${rect.left - 220}px`;
                tooltip.style.top = `${rect.top + rect.height / 2 - 20}px`;
            }
            document.body.appendChild(tooltip);
            slot.tooltip = tooltip;
        });
        
        slot.addEventListener('mouseleave', () => {
            if (slot.tooltip) {
                slot.tooltip.remove();
                slot.tooltip = null;
            }
        });
    });
}

// Animation when equipping new items
function animateEquipItem(slotElement) {
    if (!slotElement) return;
    slotElement.classList.remove('just-equipped');
    void slotElement.offsetWidth;
    slotElement.classList.add('just-equipped');
    setTimeout(() => {
        slotElement.classList.remove('just-equipped');
    }, 1000);
}

// Function to open inventory focused on specific slot type
function openInventoryForSlot(slotType) {
    socket.emit('getInventory');
    showModal(inventoryModal);
    console.log(`Opening inventory for ${slotType} slot`);
}

// Check if confirm button should be enabled
function checkConfirmButton() {
    if (selectedAttackArea && selectedBlockArea) {
        confirmMoveBtn.disabled = false;
    } else {
        confirmMoveBtn.disabled = true;
    }
}

// Reset combat selections
function resetCombatSelections() {
    selectedAttackArea = null;
    selectedBlockArea = null;
    attackAreas.forEach(area => area.classList.remove('selected'));
    blockAreas.forEach(area => area.classList.remove('selected'));
    confirmMoveBtn.disabled = true;
}

// Login function - UPDATED FOR JWT AUTH
function login(username, avatar) {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userStr || !token) {
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const userData = JSON.parse(userStr);
        playerAvatar.src = userData.avatar.startsWith('images/') ? 
            userData.avatar : `images/${userData.avatar}`;
        playerName.textContent = userData.username;
        currentUser = userData;
        socket.auth = { token };
        socket.connect();
        showScreen(lobbyScreen);
        disableStatsButtonsDuringBattle(); // Check stat button state on login
    } catch (error) {
        console.error('Error parsing user data', error);
        window.location.href = '/login.html';
    }
}

// Logout function
function logout() {
    fetch('/api/logout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    }).catch(err => console.error('Logout error:', err));
    
    socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pendingGameId'); // Clear pending game on logout
    window.location.href = '/login.html';
}

// Show specific screen
function showScreen(screen) {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    if (gameScreen) gameScreen.classList.add('hidden');
    if (shopScreen) shopScreen.classList.add('hidden');
    if (screen) screen.classList.remove('hidden');
    
    // Clean up UI and fetch data when showing lobby
    if (screen === lobbyScreen) {
        if (window.cleanupDisplacedIcons) {
            window.cleanupDisplacedIcons();
        }
        
        // Fetch fresh data when showing lobby
        if (socket && socket.connected) {
            socket.emit('getProfile');
            socket.emit('getInventory');
        }
    }
}

// Show modal
function showModal(modal, data) {
    if (modal === challengeModal) {
        selectedOpponent = data;
        opponentNameSpan.textContent = data.username;
    }
    modal.classList.remove('hidden');
}

// Hide modal
function hideModal(modal) {
    modal.classList.add('hidden');
}

// Turn timer functions
function startTurnTimer(seconds) {
    stopTurnTimer();
    turnTimeLeft = seconds;
    updateTimerDisplay();
    turnTimerInterval = setInterval(() => {
        turnTimeLeft--;
        updateTimerDisplay();
        if (turnTimeLeft <= 0) {
            stopTurnTimer();
        }
    }, 1000);
}

function stopTurnTimer() {
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }
}

function updateTimerDisplay() {
    if (turnTimerDisplay) {
        if (turnTimeLeft > 0) {
            turnTimerDisplay.textContent = turnTimeLeft;
            if (turnTimeLeft <= 5) {
                turnTimerDisplay.classList.add('urgent');
            } else {
                turnTimerDisplay.classList.remove('urgent');
            }
        } else {
            turnTimerDisplay.textContent = "Time's up!";
            turnTimerDisplay.classList.add('urgent');
        }
    }
}

// Update players list for modern UI
function updatePlayersList(players) {
    playersContainer.innerHTML = '';
    if (players.length <= 1) {
        const noPlayersMsg = document.createElement('div');
        noPlayersMsg.classList.add('no-players-msg');
        noPlayersMsg.textContent = 'No other players online. Wait for someone to join!';
        playersContainer.appendChild(noPlayersMsg);
        return;
    }
    
    // Update player count in the lobby header
    const playerCountElement = document.querySelector('.player-count');
    if (playerCountElement) {
        playerCountElement.textContent = `Players Online: ${players.length}`;
    }
    
    players.forEach(player => {
        if (player.id === socket.id) {
            // Update our own profile display in the right sidebar
            updateProfileDisplay(player);
            return;
        }
        
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-item');
        const avatarSrc = player.avatar.startsWith('images/') ? 
            player.avatar : `images/${player.avatar}`;
            
        playerItem.innerHTML = `
            <div class="player-details">
                <img src="${avatarSrc}" class="player-avatar" alt="${player.username}">
                <span class="player-name">${player.username}</span>
            </div>
            <button class="challenge-btn">Challenge</button>
        `;
        
        const challengeBtn = playerItem.querySelector('.challenge-btn');
        challengeBtn.addEventListener('click', () => {
            showModal(challengeModal, player);
        });
        
        playersContainer.appendChild(playerItem);
    });
    
    // Clean up any displaced icons
    if (window.cleanupDisplacedIcons) {
        window.cleanupDisplacedIcons();
    }
}

// Function to update profile sidebar display
function updateProfileDisplay(player) {
    // Update player avatar and name in the sidebar
    const profileAvatar = document.querySelector('.profile-avatar');
    const profileName = document.querySelector('.profile-name');
    
    if (profileAvatar) {
        profileAvatar.src = player.avatar.startsWith('images/') ? 
            player.avatar : `images/${player.avatar}`;
    }
    
    if (profileName) {
        profileName.textContent = player.username;
    }
    
    // Get stats if available and update
    if (socket && socket.connected) {
        socket.emit('getProfile');
    }
}

// Clean up any displaced icons
function cleanupDisplacedIcons() {
    // Remove any icons from stat values
    document.querySelectorAll('.stat-value').forEach(element => {
        // Keep only the text content
        const textContent = element.textContent;
        element.innerHTML = textContent;
    });
    
    // Remove any images or icons from the stats container
    document.querySelectorAll('.stats-container img, .stats-container .item-icon').forEach(element => {
        element.remove();
    });
}

// Update incoming challenges
function updateIncomingChallenges(challenge) {
    const challengeItem = document.createElement('div');
    challengeItem.classList.add('challenge-item');
    challengeItem.dataset.id = challenge.id;
    const avatarSrc = challenge.challenger.avatar.startsWith('images/') ? 
        challenge.challenger.avatar : `images/${challenge.challenger.avatar}`;
    challengeItem.innerHTML = `
        <div class="challenge-player">
            <img src="${avatarSrc}" class="player-avatar" alt="${challenge.challenger.username}">
            <span>${challenge.challenger.username} has challenged you!</span>
        </div>
        <div class="challenge-buttons">
            <button class="accept-btn">Accept</button>
            <button class="decline-btn">Decline</button>
        </div>
    `;
    const acceptBtn = challengeItem.querySelector('.accept-btn');
    acceptBtn.addEventListener('click', () => {
        socket.emit('respondToChallenge', { challengeId: challenge.id, accept: true });
        incomingChallenges.removeChild(challengeItem);
    });
    const declineBtn = challengeItem.querySelector('.decline-btn');
    declineBtn.addEventListener('click', () => {
        socket.emit('respondToChallenge', { challengeId: challenge.id, accept: false });
        incomingChallenges.removeChild(challengeItem);
    });
    incomingChallenges.appendChild(challengeItem);
}

// Add outgoing challenge
function addOutgoingChallenge(challenge) {
    const challengeItem = document.createElement('div');
    challengeItem.classList.add('challenge-item');
    challengeItem.dataset.id = challenge.id;
    const avatarSrc = challenge.opponent.avatar.startsWith('images/') ? 
        challenge.opponent.avatar : `images/${challenge.opponent.avatar}`;
    challengeItem.innerHTML = `
        <div class="challenge-player">
            <img src="${avatarSrc}" class="player-avatar" alt="${challenge.opponent.username}">
            <span>Waiting for ${challenge.opponent.username} to respond...</span>
        </div>
    `;
    outgoingChallenges.appendChild(challengeItem);
}

// Start game - MODIFIED
function startGame(gameData) {
    currentGameId = gameData.gameId;
    
    // Save game ID in case we need to rejoin
    localStorage.setItem('pendingGameId', currentGameId);
    
    // Clear any previous game state
    clearGameContainer();
    
    // Update player info
    if (gameData.opponent) {
        player1Avatar.src = currentUser.avatar.startsWith('images/') ? 
            currentUser.avatar : `images/${currentUser.avatar}`;
        player1Name.textContent = currentUser.username;
        
        const opponentAvatarSrc = gameData.opponent.avatar.startsWith('images/') ? 
            gameData.opponent.avatar : `images/${gameData.opponent.avatar}`;
        player2Avatar.src = opponentAvatarSrc;
        player2Name.textContent = gameData.opponent.username;

        // Store IDs for later
        myPlayerId = socket.id;
        opponentId = gameData.opponent.id;
    }
    
    // Show game screen
    showScreen(gameScreen);
    
    // Important: Add a slight delay before joining the game
    // This helps ensure both clients don't try to create separate games
    setTimeout(() => {
        console.log('Joining game:', currentGameId);
        socket.emit('joinGame', currentGameId);
        
        // Add initial log entry
        addLogEntry('Connecting to game session...', 'info');
        
        // Disable stats upgrading during battle
        disableStatsButtonsDuringBattle();
    }, 500);
}

// Update game state
function updateGameState(state) {
    gameState = state;
    console.log('Updating game state:', state);
    console.log('My ID:', myPlayerId, 'Opponent ID:', opponentId);
    
    const myPlayer = state.players[myPlayerId];
    const opponent = state.players[opponentId];
    
    if (myPlayer && opponent) {
        console.log('My health:', myPlayer.health, 'My energy:', myPlayer.energy);
        console.log('Opponent health:', opponent.health, 'Opponent energy:', opponent.energy);
        
        const myHealthPercent = Math.max(0, (myPlayer.health / myPlayer.maxHealth) * 100);
        const myEnergyPercent = Math.max(0, myPlayer.energy);
        const opponentHealthPercent = Math.max(0, (opponent.health / opponent.maxHealth) * 100);
        const opponentEnergyPercent = Math.max(0, opponent.energy);
        
        player1Health.style.width = `${myHealthPercent}%`;
        player1Energy.style.width = `${myEnergyPercent}%`;
        player2Health.style.width = `${opponentHealthPercent}%`;
        player2Energy.style.width = `${opponentEnergyPercent}%`;
        
        player1Health.setAttribute('title', `Health: ${myPlayer.health}/${myPlayer.maxHealth}`);
        player2Health.setAttribute('title', `Health: ${opponent.health}/${opponent.maxHealth}`);
        
        if (myPlayer.equipment) {
            updateEquipmentDisplay('player1', myPlayer.equipment);
        }
        if (opponent.equipment) {
            updateEquipmentDisplay('player2', opponent.equipment);
        }
    } else {
        console.error('Player data missing:', myPlayer, opponent);
        console.error('Game state:', state);
        console.error('Player IDs:', myPlayerId, opponentId);
        
        if (state.players && Object.keys(state.players).length === 2) {
            const playerIds = Object.keys(state.players);
            if (myPlayerId === null) {
                myPlayerId = socket.id;
                opponentId = playerIds.find(id => id !== myPlayerId);
                console.log('Recovered IDs:', myPlayerId, opponentId);
                updateGameState(state);
            }
        }
    }
}

// Update equipment display with SVG quality indicators
function updateEquipmentDisplay(playerPrefix, equipment) {
  const slots = [
    { type: 'weapon', el: document.getElementById(`${playerPrefix}-weapon-name`), item: equipment.weapon },
    { type: 'armor', el: document.getElementById(`${playerPrefix}-armor-name`), item: equipment.armor },
    { type: 'shield', el: document.getElementById(`${playerPrefix}-shield-name`), item: equipment.shield },
    { type: 'helmet', el: document.getElementById(`${playerPrefix}-helmet-name`), item: equipment.helmet }
  ];
  
  slots.forEach(slot => {
    if (!slot.el) return;
    let slotContainer;
    if (slot.type === 'weapon') {
      slotContainer = slot.el.closest('.sword-slot');
    } else {
      slotContainer = slot.el.closest(`.${slot.type}-slot`);
    }
    if (!slotContainer) return;
    
    slotContainer.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');
    
    if (slot.item) {
      slot.el.textContent = slot.item.name;
      const statValue = slot.type === 'weapon' ? slot.item.damage : slot.item.defense;
      const statType = slot.type === 'weapon' ? 'Damage' : 'Defense';
      slot.el.title = `${slot.item.name}: +${statValue} ${statType}`;
      slotContainer.classList.add('equipped');
      let quality = 'common';
      if (statValue >= 15) quality = 'legendary';
      else if (statValue >= 10) quality = 'epic';
      else if (statValue >= 8) quality = 'rare';
      else if (statValue >= 5) quality = 'uncommon';
      slotContainer.classList.add(quality);
    } else {
      slot.el.textContent = 'None';
      slot.el.title = `No ${slot.type} equipped`;
      const slotIcon = slotContainer.querySelector('.slot-icon');
      if (slotIcon) { // Ensure slotIcon exists
        if (slot.type === 'weapon') {
          slotIcon.src = 'images/slot-sword.svg';
        } else {
          slotIcon.src = `images/slot-${slot.type}.svg`;
        }
      }
    }
  });
}

// Make a move
function makeMove(attackArea, blockArea) {
    if (gameState && !waitingForOpponent && attackArea && blockArea) {
        socket.emit('makeMove', {
            gameId: currentGameId,
            attackArea,
            blockArea
        });
        waitingForOpponent = true;
        gameMessage.textContent = 'Move submitted. Waiting for opponent...';
        combatControls.classList.add('hidden');
    }
}

// Add log entry
function addLogEntry(text, type = 'info') {
    const entry = document.createElement('div');
    entry.classList.add('log-entry');
    if (type !== 'info') {
        entry.classList.add(type);
    }
    entry.textContent = text;
    gameLog.appendChild(entry);
    gameLog.scrollTop = gameLog.scrollHeight;
}

// Show combat result with enhanced combat feedback
function showCombatResult(data) {
    const myMove = data.moves[myPlayerId];
    const opponentMove = data.moves[opponentId];
    const myPlayer = data.players[myPlayerId];
    const opponent = data.players[opponentId];
    
    let resultHTML = `
        <div class="combat-result">
            <div class="combat-round">Round ${data.roundNumber || 1}</div>
            <div class="combat-players">
                <div class="combat-player">
                    <h3>Your Move</h3>
                    <div>Attack: ${myMove ? formatAreaName(myMove.attackArea) : 'None'}</div>
                    <div>Block: ${myMove ? formatAreaName(myMove.blockArea) : 'None'}</div>
                    <div class="damage-dealt">
                        Damage Dealt: <span class="damage">${data.damageDealt[myPlayerId] || 0}</span>
                    </div>
                </div>
                <div class="combat-player">
                    <h3>Opponent's Move</h3>
                    <div>Attack: ${opponentMove ? formatAreaName(opponentMove.attackArea) : 'None'}</div>
                    <div>Block: ${opponentMove ? formatAreaName(opponentMove.blockArea) : 'None'}</div>
                    <div class="damage-dealt">
                        Damage Dealt: <span class="damage">${data.damageDealt[opponentId] || 0}</span>
                    </div>
                </div>
            </div>
            <div class="combat-outcome">`;
    
    if (data.combatLog) {
        data.combatLog.forEach(entry => {
            if (entry.player === myPlayerId) {
                if (entry.type === 'hit') {
                    const criticalClass = entry.critical ? ' critical-hit' : '';
                    resultHTML += `<div class="block-info${criticalClass}">${entry.message}</div>`;
                } else if (entry.type === 'evade') {
                    resultHTML += `<div class="block-info evaded">${entry.message}</div>`;
                } else if (entry.type === 'block') {
                    resultHTML += `<div class="block-success">${entry.message}</div>`;
                }
            } else if (entry.player === opponentId) {
                if (entry.type === 'hit') {
                    resultHTML += `<div class="block-failure">${entry.message}</div>`;
                } else if (entry.type === 'evade') {
                    resultHTML += `<div class="block-failure evaded">${entry.message}</div>`;
                } else if (entry.type === 'block') {
                    resultHTML += `<div class="block-info">${entry.message}</div>`;
                }
            }
        });
    } else {
        if (myMove && opponentMove) {
            if (myMove.blockArea === opponentMove.attackArea) {
                resultHTML += `<div class="block-success">You successfully blocked the opponent's attack to your ${formatAreaName(myMove.blockArea)}! (0 damage taken)</div>`;
            } else {
                resultHTML += `<div class="block-failure">Your block failed! The opponent hit your ${formatAreaName(opponentMove.attackArea)} for ${data.damageDealt[opponentId] || 0} damage.</div>`;
            }
            if (opponentMove.blockArea === myMove.attackArea) {
                resultHTML += `<div class="block-info">Your opponent blocked your attack completely.</div>`;
            } else {
                resultHTML += `<div class="block-info">Your attack hit the opponent's ${formatAreaName(myMove.attackArea)} for ${data.damageDealt[myPlayerId] || 0} damage!</div>`;
            }
        }
    }
    resultHTML += `
            </div>
            <div class="health-status">
                <div>Your Health: ${myPlayer.health}/${myPlayer.maxHealth}</div>
                <div>Opponent Health: ${opponent.health}/${opponent.maxHealth}</div>
            </div>
        </div>
    `;
    combatResultContent.innerHTML = resultHTML;
    showModal(combatResultModal);
}

// Format area name for display
function formatAreaName(area) {
    if (!area) return 'None';
    return area.charAt(0).toUpperCase() + area.slice(1);
}

// Handle game end - MODIFIED
// Create a styled, centered container for game result messages
function handleGameEnd(result) {
    stopTurnTimer();
    
    // Clear any abandonment countdown if it exists
    if (window.abandonmentCountdown) {
        clearInterval(window.abandonmentCountdown);
        window.abandonmentCountdown = null;
    }
    
    // Clear any abandonment failsafe if it exists
    if (window.abandonmentFailsafe) {
        clearTimeout(window.abandonmentFailsafe);
        window.abandonmentFailsafe = null;
    }
    
    const gameContainer = document.querySelector('.game-container');
    
    // Reset game state variables
    currentGameId = null; // Set this to null to indicate we're not in battle
    
    // Remove any existing result displays to prevent duplicates
    const existingResults = document.querySelectorAll('.game-result-message-wrapper, .game-result, .victory-message, .profile-message, .battle-stats-message, .victory-banner');
    existingResults.forEach(element => element.remove());
    
    // Create a centered message container
    const resultWrapper = document.createElement('div');
    resultWrapper.classList.add('game-result-message-wrapper');
    
    if (result.winner === myPlayerId) {
        const resultDiv = document.createElement('div');
        resultDiv.classList.add('game-result');
        
        if (result.forfeit) {
            resultDiv.textContent = result.message || 'Victory! Your opponent forfeited!';
            resultDiv.style.color = '#4CAF50'; // Green for victory
        } else {
            resultDiv.textContent = 'Victory! You won the fight!';
        }
        
        resultWrapper.appendChild(resultDiv);
        
        if (gameState && gameState.players && opponentId && gameState.players[opponentId]) {
            if (!result.forfeit) {
                addLogEntry(`${currentUser.username} defeated ${gameState.players[opponentId].username}!`, 'heal');
            }
            addLogEntry('You earned 1 stat point!', 'heal');
        }
    } else {
        const resultDiv = document.createElement('div');
        resultDiv.classList.add('game-result');
        resultDiv.textContent = 'Defeat! You lost the fight!';
        resultWrapper.appendChild(resultDiv);
        
        if (gameState && gameState.players && opponentId && gameState.players[opponentId]) {
            addLogEntry(`${gameState.players[opponentId].username} defeated ${currentUser.username}!`, 'damage');
        }
    }
    
    // Add profile link message
    const profileMessage = document.createElement('div');
    profileMessage.classList.add('profile-message');
    profileMessage.innerHTML = 'Visit your <a href="/character-profile.html">Character Profile</a> to upgrade stats and manage equipment!';
    resultWrapper.appendChild(profileMessage);
    
    // Add the wrapper to the game container
    if (gameContainer) {
        gameContainer.appendChild(resultWrapper);
    }
    
    // Hide combat controls
    combatControls.classList.add('hidden');
    
    // Update game message
    if (!result.forfeit) {
        gameMessage.textContent = 'Game over! You can return to lobby.';
    }
    
    // Clear the pending game ID
    localStorage.removeItem('pendingGameId');
    gameState = null;
}

// Shop functions
function displayShopItems(category) {
    if (!shopData) return;
    shopItemsContainer.innerHTML = '';
    
    if (!shopData[category] || shopData[category].length === 0) {
        shopItemsContainer.innerHTML = '<div class="empty-shop">No items available in this category</div>';
        return;
    }
    
    shopData[category].forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.classList.add('shop-item');
        let statsText = '';
        if (item.damage) {
            statsText = `Damage: +${item.damage}`;
        } else if (item.defense) {
            statsText = `Defense: +${item.defense}`;
        }
        itemEl.innerHTML = `
            <div class="item-name">${item.name}</div>
            <div class="item-stats">${statsText}</div>
            <div class="item-price">
                <span class="gold">${item.price} Gold</span>
                <button class="buy-btn" data-id="${item.id}" data-type="${item.type}">Buy</button>
            </div>
        `;
        const buyBtn = itemEl.querySelector('.buy-btn');
        buyBtn.addEventListener('click', () => {
            buyItem(item.id, item.type);
        });
        shopItemsContainer.appendChild(itemEl);
    });
}

function buyItem(itemId, itemType) {
    socket.emit('buyItem', { itemId, itemType });
}

function updateInventoryDisplay(inventoryData) {
    // Update gold displays
    if (playerGoldSpan) playerGoldSpan.textContent = inventoryData.gold;
    const playerGoldShopSpan = document.getElementById('player-gold-shop');
    if (playerGoldShopSpan) playerGoldShopSpan.textContent = inventoryData.gold;
    
    // Update equipped items
    const equipped = inventoryData.equipped;
    if (equippedWeapon) equippedWeapon.textContent = equipped.weapon ? equipped.weapon.name : 'None';
    if (equippedArmor) equippedArmor.textContent = equipped.armor ? equipped.armor.name : 'None';
    if (equippedShield) equippedShield.textContent = equipped.shield ? equipped.shield.name : 'None';
    
    // Also update equipped items in the lobby side panel
    if (window.updateEquippedItemsDisplay) {
        window.updateEquippedItemsDisplay(inventoryData.equipped);
    }
    
    // Update inventory list
    if (!inventoryItemsContainer) return;
    
    inventoryItemsContainer.innerHTML = '';
    if (inventoryData.inventory.length === 0) {
        inventoryItemsContainer.innerHTML = '<div class="empty-inventory">No items</div>';
        return;
    }
    
    inventoryData.inventory.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.classList.add('inventory-item');
        let statsText = '';
        if (item.damage) {
            statsText = `Damage: +${item.damage}`;
        } else if (item.defense) {
            statsText = `Defense: +${item.defense}`;
        }
        itemEl.innerHTML = `
            <div class="item-name">${item.name}</div>
            <div class="item-stats">${statsText}</div>
            <button class="equip-btn" data-id="${item.id}" data-type="${item.type}">Equip</button>
        `;
        const equipBtn = itemEl.querySelector('.equip-btn');
        equipBtn.addEventListener('click', () => {
            equipItem(item.id, item.type);
        });
        inventoryItemsContainer.appendChild(itemEl);
    });
}

function equipItem(itemId, itemType) {
    socket.emit('equipItem', { itemId, itemType });
    let slotSelector;
    switch(itemType) {
        case 'weapon': slotSelector = '.sword-slot.right-hand-slot'; break;
        case 'armor': slotSelector = '.armor-slot'; break;
        case 'shield': slotSelector = '.shield-slot'; break;
        case 'helmet': slotSelector = '.helmet-slot'; break;
        default: slotSelector = `.${itemType}-slot`;
    }
    const playerPanel = document.querySelector('.player1-panel');
    if (playerPanel) { // Ensure playerPanel exists
        const slotElement = playerPanel.querySelector(slotSelector);
        if (slotElement) {
            lastEquippedSlot = slotElement;
        }
    }
}

// Clear game container from previous game
function clearGameContainer() {
    const existingResults = document.querySelectorAll('.game-result, .profile-message');
    existingResults.forEach(result => result.remove());
    gameLog.innerHTML = '';
    resetCombatSelections();
    combatControls.classList.add('hidden');
    gameMessage.textContent = 'Initializing game...';
}

// Updated function to update equipped items display in lobby
function updateEquippedItemsDisplay(equippedItems) {
    if (!equippedItems) return;
    
    // Get element references for the equipped items in the sidebar
    const weaponNameElement = document.getElementById('equipped-weapon-name');
    const armorNameElement = document.getElementById('equipped-armor-name');
    const shieldNameElement = document.getElementById('equipped-shield-name');
    const helmetNameElement = document.getElementById('equipped-helmet-name');
    
    // Update equipped item names
    if (weaponNameElement) {
        weaponNameElement.textContent = equippedItems.weapon ? equippedItems.weapon.name : 'None';
    }
    
    if (armorNameElement) {
        armorNameElement.textContent = equippedItems.armor ? equippedItems.armor.name : 'None';
    }
    
    if (shieldNameElement) {
        shieldNameElement.textContent = equippedItems.shield ? equippedItems.shield.name : 'None';
    }
    
    if (helmetNameElement) {
        helmetNameElement.textContent = equippedItems.helmet ? equippedItems.helmet.name : 'None';
    }
}

// Game Abandonment Functions

// When opponent initially leaves battle (starts the 10-second countdown)
socket.on('opponentLeftBattle', (data) => {
    console.log('Opponent left battle, waiting for return:', data);
    
    // Show message in the game area
    gameMessage.textContent = data.message || "Your opponent left the battle. If they don't return in 10 seconds, you'll win by forfeit!";
    
    // Create a countdown display
    const countdownEl = document.createElement('div');
    countdownEl.id = 'abandonment-countdown';
    countdownEl.style.fontSize = '24px';
    countdownEl.style.fontWeight = 'bold';
    countdownEl.style.color = '#ff5252';
    countdownEl.style.textAlign = 'center';
    countdownEl.style.margin = '20px 0';
    
    // Insert the countdown into the combat area
    const combatArea = document.querySelector('.combat-area-container');
    if (combatArea) {
        // If there's already a countdown, remove it
        const existingCountdown = document.getElementById('abandonment-countdown');
        if (existingCountdown) existingCountdown.remove();
        
        // Insert after game message
        const gameMessageEl = document.getElementById('game-message');
        if (gameMessageEl) {
            gameMessageEl.after(countdownEl);
        } else {
            combatArea.prepend(countdownEl);
        }
    }
    
    // Start countdown from 10 seconds
    let timeLeft = 10;
    countdownEl.textContent = `Opponent may return: ${timeLeft}s`;
    
    // Store interval ID to clear later
    window.abandonmentCountdown = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            countdownEl.textContent = `Opponent may return: ${timeLeft}s`;
        } else {
            countdownEl.textContent = 'Awarding victory...';
            // No need to clear interval as opponentAbandoned should be triggered
        }
    }, 1000);
    
    // Hide combat controls
    if (combatControls) {
        combatControls.classList.add('hidden');
    }
    
    // Add to game log
    addLogEntry('Your opponent left the battle. Waiting to see if they return...', 'info');
    
    // IMPORTANT: Add a failsafe - if no opponentAbandoned event is received within 15 seconds
    // force return to lobby as a fallback
    window.abandonmentFailsafe = setTimeout(() => {
        console.log('FAILSAFE: No abandonment event received, forcing return to lobby');
        
        // Only proceed if we're still waiting (haven't received opponentRejoined or opponentAbandoned)
        if (document.getElementById('abandonment-countdown')) {
            // Clear the countdown interval
            if (window.abandonmentCountdown) {
                clearInterval(window.abandonmentCountdown);
                window.abandonmentCountdown = null;
            }
            
            // Create a manual victory message
            const victoryBanner = document.createElement('div');
            victoryBanner.classList.add('victory-banner');
            victoryBanner.textContent = 'VICTORY BY FORFEIT!';
            victoryBanner.style.fontSize = '36px';
            victoryBanner.style.fontWeight = 'bold';
            victoryBanner.style.color = '#4CAF50';
            victoryBanner.style.textAlign = 'center';
            victoryBanner.style.margin = '30px 0';
            victoryBanner.style.textShadow = '0 0 10px rgba(0, 150, 0, 0.5)';
            
            // Replace the countdown with victory banner
            const countdownElement = document.getElementById('abandonment-countdown');
            if (countdownElement && countdownElement.parentNode) {
                countdownElement.parentNode.replaceChild(victoryBanner, countdownElement);
            }
            
            // Update game message
            gameMessage.textContent = "Your opponent abandoned the game. You win!";
            
            // Add log entries
            addLogEntry('FAILSAFE ACTIVATED: Your opponent abandoned the game. You win by forfeit!', 'heal');
            addLogEntry('You earned 25 gold and 1 stat point!', 'heal');
            
            // Clean up game state
            currentGameId = null;
            localStorage.removeItem('pendingGameId');
            gameState = null;
            
            // Return to lobby after 3 seconds for better user experience
            setTimeout(() => {
                showScreen(lobbyScreen);
                
                // Show a notification
                const notification = document.createElement('div');
                notification.textContent = 'Victory! Returned to lobby after opponent abandoned';
                notification.style.position = 'fixed';
                notification.style.top = '20px';
                notification.style.left = '50%';
                notification.style.transform = 'translateX(-50%)';
                notification.style.backgroundColor = '#4CAF50';
                notification.style.color = 'white';
                notification.style.padding = '10px 20px';
                notification.style.borderRadius = '5px';
                notification.style.zIndex = '1000';
                document.body.appendChild(notification);
                
                // Remove notification after 3 seconds
                setTimeout(() => {
                    if (notification.parentNode) notification.parentNode.removeChild(notification);
                }, 3000);
                
            }, 3000);
        }
    }, 15000); // 15 second timeout (5 seconds after the expected 10-second abandonment)
});

// When opponent rejoins within the 10-second window
socket.on('opponentRejoined', (data) => {
    console.log('Opponent rejoined battle:', data);
    
    // Clear any countdown
    if (window.abandonmentCountdown) {
        clearInterval(window.abandonmentCountdown);
        window.abandonmentCountdown = null;
    }
    
    // Clear the failsafe
    if (window.abandonmentFailsafe) {
        clearTimeout(window.abandonmentFailsafe);
        window.abandonmentFailsafe = null;
    }
    
    // Remove countdown element
    const countdownEl = document.getElementById('abandonment-countdown');
    if (countdownEl) countdownEl.remove();
    
    // Update game message
    gameMessage.textContent = data.message || "Your opponent has returned!";
    
    // Show combat controls again if it was your turn
    if (!waitingForOpponent && roundInProgress) {
        combatControls.classList.remove('hidden');
    }
    
    // Add log entry
    addLogEntry('Your opponent has returned to the battle.', 'info');
});

// When opponent completely abandons (after 10 seconds)
socket.on('opponentAbandoned', (data) => {
    console.log('Opponent abandoned game, awarding victory:', data);
    
    // Clear the countdown interval
    if (window.abandonmentCountdown) {
        clearInterval(window.abandonmentCountdown);
        window.abandonmentCountdown = null;
    }
    
    // Clear the failsafe
    if (window.abandonmentFailsafe) {
        clearTimeout(window.abandonmentFailsafe);
        window.abandonmentFailsafe = null;
    }
    
    // Create result for handleGameEnd
    const result = {
        winner: socket.id,
        forfeit: true,
        message: data.message || "Victory! Your opponent abandoned the game."
    };
    
    // Hide combat controls permanently
    if (combatControls) {
        combatControls.classList.add('hidden');
    }
    
    // Process the victory
    gameMessage.textContent = data.message || "Victory! Your opponent abandoned the game.";
    addLogEntry('Your opponent abandoned the game. You win by forfeit!', 'heal');
    addLogEntry(`You earned ${data.reward || 25} gold and 1 stat point!`, 'heal');
    
    // Display victory banner
    const victoryBanner = document.createElement('div');
    victoryBanner.classList.add('victory-banner');
    victoryBanner.textContent = 'VICTORY BY FORFEIT';
    victoryBanner.style.fontSize = '36px';
    victoryBanner.style.fontWeight = 'bold';
    victoryBanner.style.color = '#4CAF50';
    victoryBanner.style.textAlign = 'center';
    victoryBanner.style.padding = '30px 0';
    victoryBanner.style.textShadow = '0 0 10px rgba(0, 150, 0, 0.5)';
    
    // Replace countdown or add the banner
    const countdownEl = document.getElementById('abandonment-countdown');
    if (countdownEl) {
        countdownEl.replaceWith(victoryBanner);
    } else {
        const combatArea = document.querySelector('.combat-area-container');
        if (combatArea) {
            combatArea.prepend(victoryBanner);
        }
    }
    
    // Show return to lobby button or redirect automatically after 3 seconds
    setTimeout(() => {
        // Call handleGameEnd
        handleGameEnd(result);
        
        // Clear game state
        currentGameId = null;
        gameState = null;
        
        // Show the lobby screen
        showScreen(lobbyScreen);
        
        // Show notification that we returned to lobby automatically
        const notification = document.createElement('div');
        notification.classList.add('auto-return-notification');
        notification.textContent = 'Returned to lobby after victory';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '1000';
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }, 3000);
});

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server, authenticating...');
    const token = localStorage.getItem('token');
    if (token) {
        socket.emit('authenticate', token);
    } else {
        window.location.href = '/login.html';
    }
});

socket.on('authenticated', (data) => {
    console.log('Authentication successful:', data);
    if (data.user) {
        currentUser = data.user;
        playerAvatar.src = currentUser.avatar.startsWith('images/') ? 
            currentUser.avatar : `images/${currentUser.avatar}`;
        playerName.textContent = currentUser.username;
    }
    
    // Request player data including stats
    socket.emit('getPlayerList');
    socket.emit('getProfile');
    socket.emit('getInventory');
    
    // Clean up any displaced icons
    if (window.cleanupDisplacedIcons) {
        window.cleanupDisplacedIcons();
    }
    
    // The rejoin logic is handled in loginWithStoredCredentials via its own 'authenticated' listener
});

socket.on('authError', (error) => {
    console.error('Authentication error:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pendingGameId');
    window.location.href = '/login.html';
});

socket.on('playerList', (players) => {
    updatePlayersList(players);
});

socket.on('challengeReceived', (challenge) => {
    updateIncomingChallenges(challenge);
});

socket.on('challengeSent', (challenge) => {
    addOutgoingChallenge(challenge);
});

socket.on('challengeAccepted', (gameData) => {
    startGame(gameData);
});

socket.on('challengeRejected', (data) => {
    const challengeItems = outgoingChallenges.querySelectorAll('.challenge-item');
    challengeItems.forEach(item => {
        if (item.dataset.id === data.challengeId) {
            item.innerHTML = `<div class="challenge-player"><span>Challenge rejected</span></div>`;
            setTimeout(() => {
                if (outgoingChallenges.contains(item)) outgoingChallenges.removeChild(item);
            }, 3000);
        }
    });
});

socket.on('gameStarted', (data) => {
    console.log('Game started event received:', data);
    if (!myPlayerId || !opponentId) {
        console.log('Player IDs missing, attempting to recover');
        myPlayerId = socket.id;
        const playerIds = Object.keys(data.players);
        opponentId = playerIds.find(id => id !== myPlayerId);
        console.log('Recovered IDs:', myPlayerId, opponentId);
    }
    gameState = { gameId: data.gameId, players: data.players };
    updateGameState(gameState);
    addLogEntry('Game started! Players are ready for battle.');
    disableStatsButtonsDuringBattle();
});

socket.on('roundStarted', (data) => {
    console.log('Round started:', data);
    gameState = { gameId: data.gameId, players: data.players, roundNumber: data.roundNumber };
    updateGameState(gameState);
    resetCombatSelections();
    waitingForOpponent = false;
    roundInProgress = true;
    combatControls.classList.remove('hidden');
    gameMessage.textContent = 'Choose your attack and block areas!';
    const timeLimit = data.players[myPlayerId]?.turnTimeLimit || 30;
    startTurnTimer(timeLimit);
    addLogEntry(`Round ${data.roundNumber} started! Choose your move.`, 'info');
});

socket.on('moveReceived', (data) => {
    addLogEntry(`You chose to attack the ${data.attackArea} and block the ${data.blockArea}.`, 'info');
});

socket.on('opponentMadeMove', () => {
    addLogEntry('Your opponent has made their move.', 'info');
});

socket.on('playerSkippedTurn', (data) => {
    addLogEntry(`${data.playerName} ran out of time and skipped their turn!`, 'damage');
});

socket.on('allMovesMade', (data) => {
    stopTurnTimer();
    waitingForOpponent = false;
    addLogEntry('All moves submitted. Processing results...', 'info');
    gameMessage.textContent = 'Processing moves...';
});

socket.on('roundResult', (data) => {
    roundInProgress = false;
    waitingForOpponent = false;
    stopTurnTimer();
    gameState = { gameId: data.gameId, players: data.players, roundNumber: data.roundNumber || 1 };
    updateGameState(gameState);
    showCombatResult(data);
    const myDamage = data.damageDealt[myPlayerId] || 0;
    const opponentDamage = data.damageDealt[opponentId] || 0;
    if (data.combatLog) {
        let criticalHit = false;
        let evaded = false;
        data.combatLog.forEach(entry => {
            if (entry.type === 'hit' && entry.critical && entry.player === myPlayerId) criticalHit = true;
            if (entry.type === 'evade' && entry.player === myPlayerId) evaded = true;
        });
        if (criticalHit) addLogEntry(`CRITICAL HIT! You dealt ${myDamage} damage!`, 'heal');
        else if (evaded) addLogEntry(`You evaded the opponent's attack!`, 'heal');
        else addLogEntry(`Round complete! You dealt ${myDamage} damage and received ${opponentDamage} damage.`, 'info');
    } else {
        addLogEntry(`Round complete! You dealt ${myDamage} damage and received ${opponentDamage} damage.`, 'info');
    }
    if (data.gameOver) {
        if (data.reward && data.winner === myPlayerId) {
            addLogEntry(`You earned ${data.reward} gold!`, 'heal');
        }
        handleGameEnd({ winner: data.winner, players: data.players });
    } else {
        gameMessage.textContent = 'Round complete. Preparing next round...';
    }
});

socket.on('invalidMove', (data) => {
    addLogEntry(`Invalid move: ${data.reason}`, 'damage');
    waitingForOpponent = false;
    combatControls.classList.remove('hidden');
});

socket.on('gameOver', (result) => {
    // Only process game over if we haven't already ended the game
    if (currentGameId !== null) {
        handleGameEnd(result);
    }
});

socket.on('opponentLeft', (data) => {
    stopTurnTimer();
    
    // Update game message
    gameMessage.textContent = 'Your opponent left the game. You win by forfeit!';
    
    // Hide combat controls
    combatControls.classList.add('hidden');
    
    // Add banner message
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer && !gameContainer.querySelector('.game-result')) {
        const resultDiv = document.createElement('div');
        resultDiv.classList.add('game-result');
        resultDiv.textContent = 'Victory! Your opponent forfeited!';
        resultDiv.style.color = '#4CAF50';
        gameContainer.appendChild(resultDiv);
    }
    
    // Add to game log
    addLogEntry('Your opponent left the game. You win by forfeit!', 'info');
    
    // Clear game state
    localStorage.removeItem('pendingGameId');
    currentGameId = null;
    gameState = null;
    
    // Automatically return to lobby after 5 seconds
    setTimeout(() => {
        showScreen(lobbyScreen);
    }, 5000);
});

// Handle actual game wins when opponent disconnects (socket disconnect)
socket.on('opponentDisconnected', (data) => {
    console.log('Opponent disconnected from server:', data);
    
    // Clear any countdown
    if (window.abandonmentCountdown) {
        clearInterval(window.abandonmentCountdown);
        window.abandonmentCountdown = null;
    }
    
    // Create result for handleGameEnd
    const result = {
        winner: socket.id,
        forfeit: true,
        disconnected: true
    };
    
    // Process the victory
    stopTurnTimer();
    gameMessage.textContent = data.message || "Your opponent disconnected. You win!";
    addLogEntry('Your opponent disconnected from the server. You win by forfeit!', 'heal');
    
    // Handle game end (which should show victory and return to lobby logic)
    handleGameEnd(result);
    
    // Auto-return to lobby after 5 seconds
    setTimeout(() => {
        currentGameId = null; 
        gameState = null;
        showScreen(lobbyScreen);
    }, 5000);
});

// Receive debugging messages
socket.on('debugMessage', (data) => {
    console.log('Debug message received:', data);
    addLogEntry(`Debug: ${data.message}`, 'info');
});

// When profile data is received
socket.on('profileData', (data) => {
    console.log('Profile data received:', data);
    
    // Update lobby stats with the profile data
    if (window.updateLobbyStats) {
        window.updateLobbyStats(data);
    } else {
        // Fallback if updateLobbyStats is not available
        updateStatValues(data);
    }
});

// When stats are updated
socket.on('statsUpdate', (stats) => {
    console.log('Received stats update:', stats);
    if (window.statsManager) {
        window.statsManager.loadStatsFromServer(stats);
    }
    
    // Update lobby stats display
    socket.emit('getProfile'); // Re-fetch profile to update UI
});

// When inventory is updated
socket.on('inventory', (inventoryData) => {
    updateInventoryDisplay(inventoryData);
});

// When equipment update is confirmed
socket.on('equipmentUpdated', (data) => {
    updateInventoryDisplay({
        gold: parseInt(playerGoldSpan ? playerGoldSpan.textContent : 0),
        equipped: data.equipped,
        inventory: data.inventory
    });
    
    if (lastEquippedSlot) {
        animateEquipItem(lastEquippedSlot);
        lastEquippedSlot = null;
    }
    
    // Update equipped items in the lobby if available
    if (window.updateEquippedItemsDisplay) {
        window.updateEquippedItemsDisplay(data.equipped);
    }
});

// When a purchase is completed
socket.on('purchaseComplete', (data) => {
    alert(`You purchased ${data.item.name}!`);
    // Update gold displays
    if (playerGoldSpan) playerGoldSpan.textContent = data.newGold;
    const playerGoldShopSpan = document.getElementById('player-gold-shop');
    if (playerGoldShopSpan) playerGoldShopSpan.textContent = data.newGold;
    
    socket.emit('getInventory');
});

// When a purchase fails
socket.on('purchaseFailed', (data) => {
    alert(`Purchase failed: ${data.reason}`);
});

// When shop items are received
socket.on('shopItems', (items) => {
    shopData = items;
    displayShopItems('weapons');
});

// Level up notification
socket.on('levelUp', (data) => {
    const notification = document.createElement('div');
    notification.textContent = `Level up! You reached level ${data.level} and earned ${data.bonusPoints} stat points!`;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '15px 25px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    notification.style.fontSize = '16px';
    notification.style.fontWeight = 'bold';
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, 5000);
    
    // Update profile display
    socket.emit('getProfile');
});

// Stats awarded notification
socket.on('statPointAwarded', (data) => {
    addLogEntry(data.message, 'heal');
    
    const notification = document.createElement('div');
    notification.classList.add('stat-point-notification');
    notification.textContent = data.message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
    
    // Update profile to reflect new stat point
    socket.emit('getProfile');
});

// Fallback for updating stat values if updateLobbyStats is not available
function updateStatValues(data) {
    // Update wins and losses
    const winsElement = document.querySelector('.wins-count');
    const lossesElement = document.querySelector('.losses-count');
    const winRateElement = document.querySelector('.winrate-value');
    
    if (data.stats) {
        const wins = data.stats.totalWins || 0;
        const losses = data.stats.totalLosses || 0;
        
        if (winsElement) winsElement.textContent = wins;
        if (lossesElement) lossesElement.textContent = losses;
        
        // Calculate win rate
        let winRate = 0;
        if (wins + losses > 0) {
            winRate = Math.round((wins / (wins + losses)) * 100);
        }
        
        if (winRateElement) winRateElement.textContent = `${winRate}%`;
        
        // Update player stats in sidebar
        if (data.stats) {
            const strength = data.stats.strength || 10;
            const agility = data.stats.agility || 10;
            const intuition = data.stats.intuition || 10;
            const endurance = data.stats.endurance || 10;
            
            // Update stat values
            const strengthValue = document.querySelector('.strength-value');
            const agilityValue = document.querySelector('.agility-value');
            const intuitionValue = document.querySelector('.intuition-value');
            const enduranceValue = document.querySelector('.endurance-value');
            
            if (strengthValue) strengthValue.textContent = strength;
            if (agilityValue) agilityValue.textContent = agility;
            if (intuitionValue) intuitionValue.textContent = intuition;
            if (enduranceValue) enduranceValue.textContent = endurance;
            
            // Update stat bars
            const strengthFill = document.querySelector('.strength-fill');
            const agilityFill = document.querySelector('.agility-fill');
            const intuitionFill = document.querySelector('.intuition-fill');
            const enduranceFill = document.querySelector('.endurance-fill');
            
            const maxStat = 20;
            if (strengthFill) strengthFill.style.width = `${Math.min(100, (strength / maxStat) * 100)}%`;
            if (agilityFill) agilityFill.style.width = `${Math.min(100, (agility / maxStat) * 100)}%`;
            if (intuitionFill) intuitionFill.style.width = `${Math.min(100, (intuition / maxStat) * 100)}%`;
            if (enduranceFill) enduranceFill.style.width = `${Math.min(100, (endurance / maxStat) * 100)}%`;
        }
    }
    
    // Level info
    const level = data.level || 1;
    const levelIndicator = document.querySelector('.level-indicator');
    const rankElement = document.querySelector('.rank');
    
    if (levelIndicator) levelIndicator.textContent = `LVL ${level}`;
    if (rankElement) rankElement.textContent = `LVL ${level}`;
    
    // Clean up any displaced icons
    cleanupDisplacedIcons();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);