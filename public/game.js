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
const lobbyAvatarElement = document.getElementById('lobby-character-avatar');
const lobbyNameElement = document.getElementById('player-name');
const lobbyClassElement = document.getElementById('player-class');
const lobbyEquipmentSlots = {
    weapon: document.getElementById('equipped-weapon-name'),
    armor: document.getElementById('equipped-armor-name'),
    shield: document.getElementById('equipped-shield-name'),
    helmet: document.getElementById('equipped-helmet-name'),
    boots: document.getElementById('equipped-boots-name'),
    gloves: document.getElementById('equipped-gloves-name'),
    amulet: document.getElementById('equipped-amulet-name'),
    ring: document.getElementById('equipped-ring-name'),
};
const playersContainer = document.getElementById('players-container');
const incomingChallenges = document.getElementById('incoming-challenges');
const outgoingChallenges = document.getElementById('outgoing-challenges');
const profileBtn = document.getElementById('profile-btn');

// DOM elements - Game
const backToLobbyBtn = document.getElementById('back-to-lobby');
const player1Avatar = document.getElementById('player1-avatar');
const player1Name = document.getElementById('player1-name');
const player2Avatar = document.getElementById('player2-avatar');
const player2Name = document.getElementById('player2-name');
const combatControls = document.getElementById('combat-controls');
const gameLog = document.getElementById('game-log');
const player1Health = document.getElementById('player1-health');
const player1Energy = document.getElementById('player1-energy');
const player2Health = document.getElementById('player2-health');
const player2Energy = document.getElementById('player2-energy');
const player1WeaponName = document.getElementById('player1-weapon-name');
const player1ArmorName = document.getElementById('player1-armor-name');
const player1ShieldName = document.getElementById('player1-shield-name');
const player1HelmetName = document.getElementById('player1-helmet-name');
const player2WeaponName = document.getElementById('player2-weapon-name');
const player2ArmorName = document.getElementById('player2-armor-name');
const player2ShieldName = document.getElementById('player2-shield-name');
const player2HelmetName = document.getElementById('player2-helmet-name');
const turnTimerDisplay = document.getElementById('turn-timer');
const attackAreas = document.querySelectorAll('.attack-areas .combat-area');
const blockAreas = document.querySelectorAll('.block-areas .combat-area');
const challengeModal = document.getElementById('challenge-modal');
const opponentNameSpan = document.getElementById('opponent-name');
const confirmChallengeBtn = document.getElementById('confirm-challenge');
const cancelChallengeBtn = document.getElementById('cancel-challenge');
const combatResultModal = document.getElementById('combat-result-modal');
const combatResultContent = document.getElementById('combat-result-content');
const continueGameBtn = document.getElementById('continue-game');
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
const equippedHelmet = document.getElementById('equipped-helmet');

// FIXED: Game Message System DOM Elements
let gameMessageContainer = null;
let gameMessageWrapper = null;
let msgChooseMove = null;
let msgWaitingOpponent = null;
let msgProcessing = null;
let msgWaitingPlayers = null;

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
let lastEquippedSlot = null;
let opponentInfo = null; // Store opponent information

// Character helper functions
function getCharacterAvatar(characterClass) {
    const characterAvatars = {
        'shadowsteel': '/images/characters/shadowsteel.png',
        'ironbound': '/images/characters/ironbound.png',
        'flameheart': '/images/characters/flameheart.png',
        'venomfang': '/images/characters/venomfang.png',
        'unselected': '/images/default-avatar.png'
    };
    return characterAvatars[characterClass] || characterAvatars['unselected'];
}

function getCharacterStyles(characterClass) {
    const styles = {
        'shadowsteel': {
            containerStyle: 'box-shadow: 0 0 15px rgba(0, 0, 100, 0.8), 0 0 30px rgba(0, 0, 255, 0.5); border-color: #4a69bd;'
        },
        'ironbound': {
            containerStyle: 'box-shadow: 0 0 15px rgba(100, 100, 100, 0.8), 0 0 30px rgba(150, 150, 150, 0.5); border-color: #7a7a7a;'
        },
        'flameheart': {
            containerStyle: 'box-shadow: 0 0 15px rgba(200, 50, 0, 0.8), 0 0 30px rgba(255, 80, 0, 0.5); border-color: #bd4a4a;'
        },
        'venomfang': {
            containerStyle: 'box-shadow: 0 0 15px rgba(0, 100, 0, 0.8), 0 0 30px rgba(0, 150, 0, 0.5); border-color: #4abd4a;'
        },
        'unselected': {
            containerStyle: 'box-shadow: 0 0 10px rgba(255, 255, 255, 0.3); border-color: #666;'
        }
    };
    return styles[characterClass] || styles['unselected'];
}

function formatClassName(characterClass) {
    if (!characterClass || characterClass === 'unselected') return 'No Class';
    return characterClass.charAt(0).toUpperCase() + characterClass.slice(1);
}

function getClassType(characterClass) {
    const classTypes = {
        'shadowsteel': 'Shadow Warrior',
        'ironbound': 'Metal Berserker',
        'flameheart': 'Fire Warrior',
        'venomfang': 'Poison Assassin',
        'unselected': 'Unassigned'
    };
    return classTypes[characterClass] || 'Warrior';
}

function inBattle() {
    return gameScreen && !gameScreen.classList.contains('hidden') || currentGameId !== null;
}

function disableStatsButtonsDuringBattle() {
    if (inBattle()) {
        const statIncreaseButtons = document.querySelectorAll('.stat-increase');
        statIncreaseButtons.forEach(button => {
            button.disabled = true;
            button.style.display = 'none';
        });
        const statsHeaders = document.querySelectorAll('.stats-header');
        statsHeaders.forEach(header => {
            if (!header.querySelector('.battle-stats-message')) {
                const message = document.createElement('div');
                message.classList.add('battle-stats-message');
                message.textContent = '';
                message.style.color = '#ff5555';
                message.style.fontSize = '12px';
                message.style.marginTop = '5px';
                header.appendChild(message);
            }
        });
    } else {
        const statIncreaseButtons = document.querySelectorAll('.stat-increase');
        statIncreaseButtons.forEach(button => {
            button.disabled = false;
            button.style.display = '';
        });
        const battleMessages = document.querySelectorAll('.battle-stats-message');
        battleMessages.forEach(message => {
            message.remove();
        });
    }
}

// FIXED: Initialize Game Message System
function initializeGameMessageSystem() {
    gameMessageContainer = document.getElementById('game-message-container');
    gameMessageWrapper = document.querySelector('.game-message-wrapper');
    msgChooseMove = document.getElementById('msg-choose-move');
    msgWaitingOpponent = document.getElementById('msg-waiting-opponent');
    msgProcessing = document.getElementById('msg-processing');
    msgWaitingPlayers = document.getElementById('msg-waiting-players');
    
    if (!gameMessageContainer || !gameMessageWrapper) {
        console.warn('Game message container or wrapper not found in DOM');
        return false;
    }
    
    if (!msgChooseMove || !msgWaitingOpponent || !msgProcessing || !msgWaitingPlayers) {
        console.warn('One or more game message elements not found');
        return false;
    }
    
    console.log('Game message system initialized successfully');
    return true;
}

// FIXED: Show Game Message Function
function showGameMessage(messageId) {
    if (!gameMessageWrapper) {
        console.warn('Game message wrapper not available');
        return;
    }
    
    let messageElement = null;
    let messageIndex = 0;
    
    switch(messageId) {
        case 'choose-move':
            messageElement = msgChooseMove;
            messageIndex = 0;
            break;
        case 'waiting-opponent':
            messageElement = msgWaitingOpponent;
            messageIndex = 1;
            break;
        case 'processing':
            messageElement = msgProcessing;
            messageIndex = 2;
            break;
        case 'waiting-players':
            messageElement = msgWaitingPlayers;
            messageIndex = 3;
            break;
        default:
            console.warn('Unknown message ID:', messageId);
            return;
    }
    
    if (messageElement) {
        gameMessageWrapper.style.left = `-${messageIndex * 25}%`;
        console.log(`Showing message: ${messageId} (index: ${messageIndex})`);
    }
}

function init() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        if (window.location.pathname !== '/login.html' && window.location.pathname !== '/register.html') {
            console.log("Init: No token/user, redirecting to login.");
            window.location.href = '/login.html';
            return;
        }
    } else {
        try {
            const userData = JSON.parse(userStr);
            if (!userData.characterClass && window.location.pathname !== '/character-select.html') {
                console.log('User has no character class, redirecting to character selection');
                window.location.href = '/character-select.html';
                return;
            }
            
            setupEventListeners();
            setupEquipmentTooltips();
            setupLobbyEventHandlers();

            if (window.statsManager) {
                window.statsManager.init();
                if (typeof window.statsManager.updateStatsUI === 'function') {
                    const originalUpdateStatsUI = window.statsManager.updateStatsUI;
                    window.statsManager.updateStatsUI = function(...args) {
                        originalUpdateStatsUI.apply(this, args);
                        disableStatsButtonsDuringBattle();
                    };
                }
            }

            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                console.log("Init: On index page, logging in with stored credentials.");
                loginWithStoredCredentials();
            }
        } catch (error) {
            console.error('Error parsing user data in init', error);
            window.location.href = '/login.html';
        }
    }
}

function loginWithStoredCredentials() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const userData = JSON.parse(userStr);
            console.log("loginWithStoredCredentials: Found user data, proceeding to login.", userData);
            login(userData.username, userData.avatar);

            const pendingGameId = localStorage.getItem('pendingGameId');
            if (pendingGameId) {
                socket.once('connect', () => {
                    console.log('Authenticated via handshake, attempting to rejoin game:', pendingGameId);
                    socket.emit('rejoinGame', pendingGameId);
                    localStorage.removeItem('pendingGameId');
                });
            }
        } catch (error) {
            console.error('Error parsing user data in loginWithStoredCredentials', error);
            window.location.href = '/login.html';
        }
    } else {
        console.log("loginWithStoredCredentials: No user string, redirecting to login.");
        window.location.href = '/login.html';
    }
}

function setupEventListeners() {
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedAvatar = option.getAttribute('data-avatar');
        });
    });

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const usernameVal = usernameInput.value.trim();
            if (usernameVal) {
                console.warn("Manual login button clicked - this flow might need to align with API login.");
                login(usernameVal, selectedAvatar);
            } else {
                alert('Please enter a username');
            }
        });
    }

    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (profileBtn) profileBtn.addEventListener('click', () => { window.location.href = '/character-profile.html'; });
    if (backToLobbyBtn) {
        backToLobbyBtn.addEventListener('click', () => {
            if (currentGameId) {
                socket.emit('leaveGame', currentGameId);
                currentGameId = null;
                gameState = null;
                stopTurnTimer();
                localStorage.removeItem('pendingGameId');
            }
            showScreen(lobbyScreen);
            disableStatsButtonsDuringBattle();
        });
    }

    if (confirmChallengeBtn) {
        confirmChallengeBtn.addEventListener('click', () => {
            if (selectedOpponent && selectedOpponent.id) {
                socket.emit('challengePlayer', selectedOpponent.id);
                hideModal(challengeModal);
            }
        });
    }

    if (cancelChallengeBtn) cancelChallengeBtn.addEventListener('click', () => hideModal(challengeModal));
    if (usernameInput) usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    
    // Combat area event listeners with auto-submit
    attackAreas.forEach(area => {
        area.addEventListener('click', () => {
            if (roundInProgress || waitingForOpponent) return;
            
            attackAreas.forEach(a => a.classList.remove('selected'));
            area.classList.add('selected');
            selectedAttackArea = area.getAttribute('data-area');
            checkConfirmButton(); // This will auto-submit if both are selected
        });
    });
    
    blockAreas.forEach(area => {
        area.addEventListener('click', () => {
            if (roundInProgress || waitingForOpponent) return;
            
            blockAreas.forEach(a => a.classList.remove('selected'));
            area.classList.add('selected');
            selectedBlockArea = area.getAttribute('data-area');
            checkConfirmButton(); // This will auto-submit if both are selected
        });
    });
    
    if (continueGameBtn) continueGameBtn.addEventListener('click', () => hideModal(combatResultModal));
    if (openShopBtn) {
        openShopBtn.addEventListener('click', () => {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to access the shop');
                window.location.href = '/login.html';
                return;
            }
            window.location.href = '/shop.html';
        });
    }
    if (backToLobbyFromShopBtn) backToLobbyFromShopBtn.addEventListener('click', () => showScreen(lobbyScreen));
    if (openInventoryBtn) openInventoryBtn.addEventListener('click', () => { 
        if (window.modernInventorySystem) {
            window.modernInventorySystem.openInventory();
        } else {
            socket.emit('getInventory'); 
            showModal(inventoryModal);
        }
    });
    if (closeInventoryBtn) closeInventoryBtn.addEventListener('click', () => hideModal(inventoryModal));
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            displayShopItems(btn.getAttribute('data-category'));
        });
    });
    
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
            if (slotType === 'left-hand' || slotType === 'right-hand' || slotType === 'sword') slotType = 'weapon';
            openInventoryForSlot(slotType);
        });
    });
}

function setupLobbyEventHandlers() {
    const viewDetailsBtn = document.getElementById('player-profile-detail-btn');
    if (viewDetailsBtn) viewDetailsBtn.addEventListener('click', () => { window.location.href = '/character-profile.html'; });
    const findMatchBtn = document.getElementById('find-match-btn');
    if (findMatchBtn) {
        findMatchBtn.addEventListener('click', () => {
            const playerListContainer = document.querySelector('.player-list-container');
            if (playerListContainer) playerListContainer.scrollIntoView({ behavior: 'smooth' });
        });
    }
}

function setupEquipmentTooltips() {
    document.querySelectorAll('.equipment-slot').forEach(slot => {
        let tooltip = null;
        
        slot.addEventListener('mouseenter', (e) => {
            const slotName = slot.querySelector('.equipment-name');
            if (slotName && slotName.textContent !== 'None') {
                tooltip = document.createElement('div');
                tooltip.className = 'equipment-tooltip';
                tooltip.innerHTML = `
                    <div class="tooltip-title">${slotName.textContent}</div>
                    <div class="tooltip-stats">+5 Damage</div>
                `;
                document.body.appendChild(tooltip);
                
                const rect = slot.getBoundingClientRect();
                tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
            }
        });
        
        slot.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        });
    });
}

function animateEquipItem(slotElement) {
    slotElement.classList.add('just-equipped');
    setTimeout(() => {
        slotElement.classList.remove('just-equipped');
    }, 1000);
}

function openInventoryForSlot(slotType) {
    lastEquippedSlot = slotType;
    socket.emit('getInventory');
    showModal(inventoryModal);
}

function checkConfirmButton() {
    if (selectedAttackArea && selectedBlockArea) {
        makeMove(selectedAttackArea, selectedBlockArea);
    }
}

function resetCombatSelections() {
    selectedAttackArea = null;
    selectedBlockArea = null;
    attackAreas.forEach(area => area.classList.remove('selected'));
    blockAreas.forEach(area => area.classList.remove('selected'));
}

function login(username, avatarFallback) {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userStr || !token) {
        console.log("Login function: No user string or token in localStorage, redirecting to login.html");
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const userData = JSON.parse(userStr);
        currentUser = userData;

        // Use the new lobby avatar element if it exists
        const lobbyAvatar = document.getElementById('player-avatar');
        if (lobbyAvatar) {
            let avatarSrc = userData.avatar || 'default-avatar.png';
            if (userData.characterClass && userData.characterClass !== 'unselected') {
                avatarSrc = `images/characters/${userData.characterClass}.png`;
            } else if (!avatarSrc.startsWith('images/')) {
                avatarSrc = `images/${avatarSrc}`;
            }
            lobbyAvatar.src = avatarSrc;
        }

        const lobbyName = document.getElementById('player-name');
        if (lobbyName) {
            lobbyName.textContent = currentUser.username;
        }
        
        socket.auth = { token: token };
        console.log("Attempting socket connection with token for user:", currentUser.username);
        socket.connect();

        showScreen(lobbyScreen);
        
        socket.once('connect', () => {
            myPlayerId = socket.id;
            console.log("Socket connected, myPlayerId set to:", myPlayerId);
            console.log("Fetching initial profile and inventory for", currentUser.username);
            socket.emit('getProfile');
            socket.emit('getInventory');
        });

        disableStatsButtonsDuringBattle(); 
    } catch (error) {
        console.error('Error parsing user data during login function', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
}

function logout() {
    fetch('/api/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }})
    .catch(err => console.error('Logout API call error:', err));
    
    if(socket && socket.connected) socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pendingGameId');
    currentUser = null;
    myPlayerId = null;
    window.location.href = '/login.html';
}

function showScreen(screen) {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    if (gameScreen) gameScreen.classList.add('hidden');
    if (shopScreen) shopScreen.classList.add('hidden');
    if (screen) screen.classList.remove('hidden');
    
    if (screen === lobbyScreen) {
        if (window.cleanupDisplacedIcons) window.cleanupDisplacedIcons();
    }
    
    // Initialize game message system when showing game screen
    if (screen === gameScreen) {
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            initializeGameMessageSystem();
            showGameMessage('waiting-players');
        }, 100);
    }
}

function showModal(modal, data) {
    if (modal === challengeModal && data) {
        selectedOpponent = data;
        opponentNameSpan.textContent = data.username;
    }
    if (modal) modal.classList.remove('hidden');
}

function hideModal(modal) {
    if (modal) modal.classList.add('hidden');
}

function startTurnTimer(seconds) {
    turnTimeLeft = seconds;
    updateTimerDisplay();
    
    turnTimerInterval = setInterval(() => {
        turnTimeLeft--;
        updateTimerDisplay();
        
        if (turnTimeLeft <= 0) {
            clearInterval(turnTimerInterval);
            if (!waitingForOpponent) {
                makeMove(null, null);
            }
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
        turnTimerDisplay.textContent = turnTimeLeft;
        if (turnTimeLeft <= 10) {
            turnTimerDisplay.classList.add('urgent');
        } else {
            turnTimerDisplay.classList.remove('urgent');
        }
    }
}

function updatePlayersList(players) {
    console.log('🔍 CLIENT: updatePlayersList called with:', players.length, 'players');

    const playersListContainer = document.getElementById('players-container');
    if (!playersListContainer) {
        console.error("❌ players-container DOM element not found!");
        return;
    }
    
    playersListContainer.innerHTML = '';

    const playerCountElement = document.querySelector('.lobby-header .player-count');
    if (playerCountElement) {
        playerCountElement.textContent = `Players Online: ${players.length}`;
    }

    let otherPlayersCount = 0;
    
    players.forEach(player => {
        if (player.socketId === myPlayerId) {
            return; 
        }

        otherPlayersCount++;
        
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-item');
        
        if (player.characterClass && player.characterClass !== 'unselected') {
            playerItem.setAttribute('data-class', player.characterClass);
        }
        
        const isBot = player.isBot || player.socketId.startsWith('bot_');
        const botIndicator = isBot ? ' 🤖' : '';
        
        const characterClassDisplay = player.characterClass && player.characterClass !== 'unselected' 
            ? formatClassName(player.characterClass)
            : 'No Class';
        
        playerItem.innerHTML = `
            <div class="player-details">
                <div class="player-name-list-item">${escapeHtml(player.username)}${botIndicator}</div>
                <div class="player-level">Level ${player.level || 1}</div>
                <div class="player-class">${characterClassDisplay}</div>
            </div>
            <button class="challenge-btn" data-player-id="${player.socketId}">Challenge</button>
        `;

        const challengeBtn = playerItem.querySelector('.challenge-btn');
        challengeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showModal(challengeModal, { 
                id: player.socketId,
                userId: player.userId,
                username: player.username,
                avatar: player.avatar
            });
        });
        
        playerItem.classList.add('new-player');
        setTimeout(() => {
            playerItem.classList.remove('new-player');
        }, 500);
        
        playersListContainer.appendChild(playerItem);
    });

    if (otherPlayersCount === 0) {
        playersListContainer.innerHTML = '<div class="no-players-msg">No other players online.</div>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

// THIS IS THE NEW FUNCTION TO UPDATE THE LOBBY CHARACTER DISPLAY
function updateProfileDisplay(playerData) {
    if (!playerData) return;

    // The key change is here: target the new, unique ID.
    const lobbyAvatarElement = document.getElementById('lobby-character-display-avatar'); 
    
    const lobbyNameElement = document.getElementById('player-name');
    const lobbyClassElement = document.getElementById('player-class');

    const usernameToDisplay = playerData.username || (currentUser ? currentUser.username : 'Player');

    let avatarSrc = `images/${playerData.avatar || 'default-avatar.png'}`;
    let classType = 'Unassigned';

    if (playerData.characterClass && playerData.characterClass !== 'unselected') {
        avatarSrc = `images/characters/${playerData.characterClass}.png`;
        const classInfo = {
            'shadowsteel': { subclass: 'Shadow Warrior' },
            'ironbound': { subclass: 'Metal Berserker' },
            'flameheart': { subclass: 'Fire Warrior' },
            'venomfang': { subclass: 'Poison Assassin' }
        };
        classType = classInfo[playerData.characterClass]?.subclass || 'Warrior';
    }

    if (lobbyAvatarElement) {
        lobbyAvatarElement.src = avatarSrc;
        lobbyAvatarElement.onerror = () => { lobbyAvatarElement.src = 'images/default-avatar.png'; };
    }
    if (lobbyNameElement) {
        lobbyNameElement.textContent = usernameToDisplay;
    }
    if (lobbyClassElement) {
        lobbyClassElement.textContent = classType;
    }
}

function updateIncomingChallenges(challenge) {
    console.log('[Client] Received "challengeReceived" event with data:', challenge);
    
    if (!incomingChallenges) {
        console.error("incomingChallenges DOM element not found!");
        return;
    }
    
    if (!challenge || !challenge.id || !challenge.challenger) {
        console.error("Malformed challenge data received:", challenge);
        return;
    }
    
    if (document.getElementById(`challenge-${challenge.id}`)) {
        console.log('Challenge already exists, skipping duplicate:', challenge.id);
        return;
    }
    
    const challengeItem = document.createElement('div');
    challengeItem.classList.add('challenge-item', 'challenge-item-enhanced');
    challengeItem.id = `challenge-${challenge.id}`;
    
    const characterClass = challenge.challenger.characterClass || 'unselected';
    const characterAvatar = getCharacterAvatar(characterClass);
    const characterStyles = getCharacterStyles(characterClass);
    
    challengeItem.innerHTML = `
        <div class="challenge-character-display">
            <div class="challenger-avatar-container ${characterClass}" style="${characterStyles.containerStyle}">
                <img src="${characterAvatar}" class="challenger-character-avatar" alt="${challenge.challenger.username}'s character">
                <div class="character-class-label">
                    <div class="class-name">${formatClassName(characterClass)}</div>
                    <div class="class-type">${getClassType(characterClass)}</div>
                </div>
            </div>
            
            <div class="challenger-info">
                <div class="challenger-name-section">
                    <h3 class="challenger-username">${challenge.challenger.username}</h3>
                    <div class="challenger-level">LVL <span class="level-value">...</span></div>
                </div>
                
                <div class="challenger-stats-preview loading">
                    <div class="stat-preview-item"><span class="stat-icon">💪</span><span class="stat-value strength-val">-</span></div>
                    <div class="stat-preview-item"><span class="stat-icon">🏃</span><span class="stat-value agility-val">-</span></div>
                    <div class="stat-preview-item"><span class="stat-icon">🧠</span><span class="stat-value intuition-val">-</span></div>
                    <div class="stat-preview-item"><span class="stat-icon">❤️</span><span class="stat-value endurance-val">-</span></div>
                </div>
                
                <div class="challenger-record">
                    <span class="wins">Wins: <span class="wins-val">-</span></span>
                    <span class="losses">Losses: <span class="losses-val">-</span></span>
                </div>
            </div>
        </div>
        
        <div class="challenge-actions">
            <button class="accept-btn">Accept</button>
            <button class="decline-btn">Decline</button>
        </div>
    `;
    
    const acceptBtn = challengeItem.querySelector('.accept-btn');
    const declineBtn = challengeItem.querySelector('.decline-btn');
    
    acceptBtn.addEventListener('click', () => {
        socket.emit('respondToChallenge', {
            challengeId: challenge.id,
            accepted: true,
            challengerId: challenge.challenger.socketId
        });
        challengeItem.remove();
    });
    
    declineBtn.addEventListener('click', () => {
        socket.emit('respondToChallenge', {
            challengeId: challenge.id,
            accepted: false,
            challengerId: challenge.challenger.socketId
        });
        challengeItem.remove();
    });
    
    incomingChallenges.appendChild(challengeItem);
    
    socket.emit('getChallengerStats', challenge.challenger.userId, (statsData) => {
        const existingItem = document.getElementById(`challenge-${challenge.id}`);
        if (!existingItem) return;
        
        if (!statsData.error) {
            existingItem.querySelector('.level-value').textContent = statsData.level || 1;
            existingItem.querySelector('.strength-val').textContent = statsData.stats?.strength || 10;
            existingItem.querySelector('.agility-val').textContent = statsData.stats?.agility || 10;
            existingItem.querySelector('.intuition-val').textContent = statsData.stats?.intuition || 10;
            existingItem.querySelector('.endurance-val').textContent = statsData.stats?.endurance || 10;
            existingItem.querySelector('.wins-val').textContent = statsData.stats?.totalWins || 0;
            existingItem.querySelector('.losses-val').textContent = statsData.stats?.totalLosses || 0;
            
            const statsPreview = existingItem.querySelector('.challenger-stats-preview');
            if (statsPreview) {
                statsPreview.classList.remove('loading');
            }
        }
    });
    
    const challengeSound = new Audio('sounds/challenge.mp3');
    challengeSound.play().catch(error => console.log('Could not play challenge sound:', error));
}

function addOutgoingChallenge(challenge) {
    if (!outgoingChallenges) {
        console.error("outgoingChallenges DOM element not found!");
        return;
    }
    
    const challengeItem = document.createElement('div');
    challengeItem.classList.add('outgoing-challenge');
    challengeItem.id = `outgoing-${challenge.id}`;
    
    challengeItem.innerHTML = `
        <div class="challenge-info"><span class="challenge-text">Waiting for ${challenge.opponentName} to respond...</span></div>
        <div class="challenge-time"><span class="timestamp">Just now</span></div>
    `;
    
    outgoingChallenges.appendChild(challengeItem);
    
    setTimeout(() => {
        const element = document.getElementById(`outgoing-${challenge.id}`);
        if (element) {
            element.remove();
        }
    }, 60000);
}

function startGame(gameData) {
    console.log('🎮 Starting game with data:', gameData);
    
    currentGameId = gameData.gameId;
    opponentInfo = {
        name: gameData.opponent.username,
        isBot: gameData.opponent.id.startsWith('bot_')
    };

    localStorage.setItem('pendingGameId', currentGameId);
    clearGameContainer();
    
    if (currentUser && gameData.opponent) {
        if (currentUser.characterClass && currentUser.characterClass !== 'unselected') {
            player1Avatar.src = getCharacterAvatar(currentUser.characterClass);
        } else {
            player1Avatar.src = currentUser.avatar.startsWith('images/') ? currentUser.avatar : `images/${currentUser.avatar}`;
        }
        player1Name.textContent = currentUser.username;
        
        if (gameData.opponent.characterClass && gameData.opponent.characterClass !== 'unselected') {
            player2Avatar.src = getCharacterAvatar(gameData.opponent.characterClass);
        } else {
            let opponentAvatarSrc = gameData.opponent.avatar;
            if (opponentAvatarSrc && !opponentAvatarSrc.startsWith('images/')) {
                opponentAvatarSrc = `images/${opponentAvatarSrc}`;
            } else if (!opponentAvatarSrc) {
                opponentAvatarSrc = 'images/default-avatar.png';
            }
            player2Avatar.src = opponentAvatarSrc;
        }
        player2Name.textContent = gameData.opponent.username;

        myPlayerId = socket.id;
        opponentId = gameData.opponent.id;
    } else {
        console.error("Cannot start game: currentUser or opponent data missing.");
        return;
    }
    
    showScreen(gameScreen);
    
    setTimeout(() => {
        socket.emit('joinGame', currentGameId);
        addLogEntry('Connecting to game session...', 'info');
        disableStatsButtonsDuringBattle();
    }, 100);
}

// THIS IS THE NEW FUNCTION TO UPDATE LOBBY EQUIPMENT DISPLAY
function updateEquippedItemsDisplay(equippedItems) {
    if (!equippedItems) return;

    Object.keys(lobbyEquipmentSlots).forEach(slotType => {
        const nameElement = lobbyEquipmentSlots[slotType];
        if (nameElement) {
            nameElement.textContent = equippedItems[slotType] ? equippedItems[slotType].name : 'None';
        }
    });

    // Fallback for old inventory modal (if it still exists in some context)
    if (equippedWeapon) equippedWeapon.textContent = equippedItems.weapon ? equippedItems.weapon.name : 'None';
    if (equippedArmor) equippedArmor.textContent = equippedItems.armor ? equippedItems.armor.name : 'None';
    if (equippedShield) equippedShield.textContent = equippedItems.shield ? equippedItems.shield.name : 'None';
    if (equippedHelmet) equippedHelmet.textContent = equippedItems.helmet ? equippedItems.helmet.name : 'None';
}

const FALLBACK_IMAGES = {
    weapon: 'images/slot-sword.svg', armor: 'images/slot-armor.svg', shield: 'images/slot-shield.svg', helmet: 'images/slot-helmet.svg',
    boots: 'images/slot-boots.svg', gloves: 'images/slot-gloves.svg', amulet: 'images/slot-amulet.svg', ring: 'images/slot-ring.svg'
};

function updateInGameEquipmentDisplay(playerPrefix, equipment) {
    if (!equipment) return;
    
    const slotTypes = ['weapon', 'armor', 'shield', 'helmet', 'boots', 'gloves', 'ring', 'amulet'];
    
    slotTypes.forEach(slotType => {
        const slotElement = document.querySelector(`.${playerPrefix}-panel .${slotType}-slot`);
        if (!slotElement) return;
        
        const slotIcon = slotElement.querySelector('.slot-icon');
        const itemNameElement = slotElement.querySelector('.equipment-name');
        
        if (!slotIcon || !itemNameElement) return;
        
        const equippedItem = equipment[slotType];
        
        slotElement.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');
        
        if (equippedItem) {
            itemNameElement.textContent = equippedItem.name;
            slotElement.classList.add('equipped');
            if (equippedItem.rarity) slotElement.classList.add(equippedItem.rarity);
            
            const statText = equippedItem.damage ? `+${equippedItem.damage} Dmg` : equippedItem.defense ? `+${equippedItem.defense} Def` : '';
            slotElement.title = `${equippedItem.name}\n${statText}`;
            
            if (equippedItem.image) {
                slotIcon.src = equippedItem.image;
                slotIcon.onerror = () => { slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg'; };
            } else {
                slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg';
            }
        } else {
            slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg';
            slotIcon.onerror = null;
            itemNameElement.textContent = 'None';
            slotElement.title = `${slotType.charAt(0).toUpperCase() + slotType.slice(1)} Slot`;
        }
    });
}

// FIXED: Updated updateGameState function
function updateGameState(state) {
    gameState = state;
    console.log('🎮 Game state updated:', state);
    
    const player1Data = state.players[myPlayerId];
    const player2Data = state.players[opponentId] || Object.values(state.players).find(p => p.socketId !== myPlayerId);

    const BASE_XP_TO_LEVEL = 1000;
    const XP_INCREASE_PER_LEVEL = 200;

    function getTotalXPForLevel(level) {
        if (level <= 1) return 0;
        let totalXP = 0;
        for (let i = 2; i <= level; i++) totalXP += BASE_XP_TO_LEVEL + (i - 2) * XP_INCREASE_PER_LEVEL;
        return totalXP;
    }

    function getXPForNextLevelUp(currentLevel) {
        return BASE_XP_TO_LEVEL + (currentLevel - 1) * XP_INCREASE_PER_LEVEL;
    }
    
    if (player1Data) {
        player1Health.style.width = `${(player1Data.health / player1Data.maxHealth) * 100}%`;
        player1Health.parentElement.title = `Health: ${player1Data.health}/${player1Data.maxHealth}`;
        
        if (player1Data.level && player1Energy) {
            const level = player1Data.level.level || 1;
            const totalXP = player1Data.level.totalXP || 0;
            const xpForCurrentLevel = getTotalXPForLevel(level);
            const xpForNextLevelUp = getXPForNextLevelUp(level);
            const currentLevelXP = totalXP - xpForCurrentLevel;
            const xpPercentage = (currentLevelXP / xpForNextLevelUp) * 100;
            player1Energy.style.width = `${Math.min(100, xpPercentage)}%`;
            player1Energy.parentElement.title = `XP: ${currentLevelXP} / ${xpForNextLevelUp}`;
        }
        
        updateInGameEquipmentDisplay('player1', player1Data.equipment);
        
        if (player1Data.stats) {
            const strengthElement = document.getElementById('player1-strength-value');
            const agilityElement = document.getElementById('player1-agility-value');
            const intuitionElement = document.getElementById('player1-intuition-value');
            const enduranceElement = document.getElementById('player1-endurance-value');
            
            if (strengthElement) strengthElement.textContent = player1Data.stats.strength;
            if (agilityElement) agilityElement.textContent = player1Data.stats.agility;
            if (intuitionElement) intuitionElement.textContent = player1Data.stats.intuition;
            if (enduranceElement) enduranceElement.textContent = player1Data.stats.endurance;
        }
    }
    
    if (player2Data) {
        player2Health.style.width = `${(player2Data.health / player2Data.maxHealth) * 100}%`;
        player2Health.parentElement.title = `Health: ${player2Data.health}/${player2Data.maxHealth}`;

        if (player2Data.level && player2Energy) {
            const level = player2Data.level.level || 1;
            const totalXP = player2Data.level.totalXP || 0;
            const xpForCurrentLevel = getTotalXPForLevel(level);
            const xpForNextLevelUp = getXPForNextLevelUp(level);
            const currentLevelXP = totalXP - xpForCurrentLevel;
            const xpPercentage = (currentLevelXP / xpForNextLevelUp) * 100;
            player2Energy.style.width = `${Math.min(100, xpPercentage)}%`;
            player2Energy.parentElement.title = `XP: ${currentLevelXP} / ${xpForNextLevelUp}`;
        }

        updateInGameEquipmentDisplay('player2', player2Data.equipment);

        if (player2Data.stats) {
            const strengthElement = document.getElementById('player2-strength-value');
            const agilityElement = document.getElementById('player2-agility-value');
            const intuitionElement = document.getElementById('player2-intuition-value');
            const enduranceElement = document.getElementById('player2-endurance-value');
            
            if (strengthElement) strengthElement.textContent = player2Data.stats.strength;
            if (agilityElement) agilityElement.textContent = player2Data.stats.agility;
            if (intuitionElement) intuitionElement.textContent = player2Data.stats.intuition;
            if (enduranceElement) enduranceElement.textContent = player2Data.stats.endurance;
        }
    }
    
    // FIXED: Proper message state handling with message system
    if (state.waitingForPlayers) {
        showGameMessage('waiting-players');
        if (combatControls) combatControls.style.display = 'none';
    } else if (state.currentRound > 0 && !waitingForOpponent && !roundInProgress) {
        showGameMessage('choose-move');
        if (combatControls) {
            combatControls.style.display = 'flex';
            combatControls.style.opacity = '1';
        }
    } else if (waitingForOpponent) {
        showGameMessage('waiting-opponent');
        if (combatControls) {
            combatControls.style.display = 'flex';
            combatControls.style.opacity = '0.5';
        }
    } else if (roundInProgress) {
        showGameMessage('processing');
        if (combatControls) {
            combatControls.style.display = 'flex';
            combatControls.style.opacity = '0.5';
        }
    } else {
        // Default to waiting for players if state is unclear
        showGameMessage('waiting-players');
        if (combatControls) combatControls.style.display = 'none';
    }
}

function makeMove(attackArea, blockArea) {
    if (!currentGameId || waitingForOpponent || roundInProgress) {
        console.log('Cannot make move:', { currentGameId, waitingForOpponent, roundInProgress });
        return;
    }
    
    waitingForOpponent = true;
    if (combatControls) combatControls.style.opacity = '0.5';

    // Show the "Waiting for opponent" message
    showGameMessage('waiting-opponent');
    
    socket.emit('makeMove', {
        gameId: currentGameId,
        attackArea: attackArea,
        blockArea: blockArea
    });
    
    addLogEntry(`You attacked ${attackArea || 'nowhere'} and blocked ${blockArea || 'nowhere'}`, 'info');
    resetCombatSelections();
}

function addLogEntry(text, type = 'info') {
    const entry = document.createElement('div');
    entry.classList.add('log-entry', type);
    entry.textContent = text;
    gameLog.appendChild(entry);
    gameLog.scrollTop = gameLog.scrollHeight;
}

function showCombatResult(data) {
    let resultHTML = '<div class="combat-result">';
    resultHTML += `<h3 class="combat-round">Round ${data.round} Results</h3>`;
    
    resultHTML += '<div class="combat-players">';
    
    Object.keys(data.moves).forEach(playerId => {
        const isMe = playerId === myPlayerId;
        const player = gameState.players[playerId];
        const move = data.moves[playerId];
        const damage = data.damageDealt[playerId] || 0;
        
        resultHTML += `<div class="combat-player">`;
        resultHTML += `<h3>${isMe ? 'You' : player.username}</h3>`;
        
        if (move.auto) {
            resultHTML += `<p>Timed out - no action taken</p>`;
        } else {
            resultHTML += `<p>Attacked: <strong>${move.attackArea || 'None'}</strong></p>`;
            resultHTML += `<p>Blocked: <strong>${move.blockArea || 'None'}</strong></p>`;
        }
        
        if (damage > 0) {
            resultHTML += `<p class="damage-dealt">Damage dealt: <span class="damage">${damage}</span></p>`;
        }
        
        resultHTML += '</div>';
    });
    
    resultHTML += '</div>';
    
    if (data.combatLog && data.combatLog.length > 0) {
        resultHTML += '<div class="combat-outcome">';
        data.combatLog.forEach(log => {
            if (log.type === 'block') {
                resultHTML += `<p class="block-success">${log.message}</p>`;
            } else if (log.type === 'hit') {
                resultHTML += `<p class="block-failure">${log.message}</p>`;
            } else if (log.type === 'evade') {
                resultHTML += `<p class="evade-message">${log.message}</p>`;
            } else {
                resultHTML += `<p class="block-info">${log.message}</p>`;
            }
        });
        resultHTML += '</div>';
    }
    
    resultHTML += '<div class="health-status">';
    Object.keys(gameState.players).forEach(playerId => {
        const player = gameState.players[playerId];
        const isMe = playerId === myPlayerId;
        resultHTML += `<div>${isMe ? 'Your' : player.username + "'s"} Health: ${player.health}/${player.maxHealth}</div>`;
    });
    resultHTML += '</div>';
    
    resultHTML += '</div>';
    
    combatResultContent.innerHTML = resultHTML;
    showModal(combatResultModal);
}

function formatAreaName(area) {
    if (!area) return 'nowhere';
    return area.charAt(0).toUpperCase() + area.slice(1);
}

function handleGameEnd(result) {
    stopTurnTimer();
    currentGameId = null;
    gameState = null;
    opponentInfo = null;
    localStorage.removeItem('pendingGameId');
    
    let endMessage = '';
    if (result.isDraw || result.reason === 'draw') {
        endMessage = 'The battle ended in a DRAW!';
    } else if (result.winner === myPlayerId) {
        endMessage = 'Victory! You have defeated your opponent!';
    } else if (result.reason === 'opponent_abandoned') {
        endMessage = 'Your opponent has abandoned the battle. You win!';
    } else if (result.reason === 'you_abandoned') {
        endMessage = 'You have abandoned the battle. You lose!';
    } else {
        endMessage = 'Defeat! You have been defeated.';
    }
    
    addLogEntry(endMessage, result.winner === myPlayerId ? 'heal' : 'damage');
    
    setTimeout(() => {
        alert(endMessage);
        showScreen(lobbyScreen);
        disableStatsButtonsDuringBattle();
    }, 2000);
}

function displayShopItems(category) {
    if (!shopData || !shopData[category]) return;
    
    shopItemsContainer.innerHTML = '';
    
    shopData[category].forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('shop-item');
        itemDiv.innerHTML = `
            <div class="item-name">${item.name}</div>
            <div class="item-stats">${item.description || `+${item.damage || item.defense || 0} ${item.damage ? 'Damage' : 'Defense'}`}</div>
            <div class="item-price">
                <span class="gold">${item.price} gold</span>
                <button onclick="buyItem('${item._id}', '${category}')">Buy</button>
            </div>
        `;
        shopItemsContainer.appendChild(itemDiv);
    });
}

function buyItem(itemId, itemType) {
    socket.emit('buyItem', { itemId, itemType });
}

function updateInventoryDisplay(inventoryData) {
    if (playerGoldSpan) playerGoldSpan.textContent = inventoryData.gold;
    
    const goldShopSpan = document.getElementById('player-gold-shop');
    if (goldShopSpan) goldShopSpan.textContent = inventoryData.gold;
    
    if (inventoryData.equipped) {
        updateEquippedItemsDisplay(inventoryData.equipped);
    }
    
    if (inventoryItemsContainer) {
        inventoryItemsContainer.innerHTML = '';
        
        if (inventoryData.inventory && inventoryData.inventory.length > 0) {
            inventoryData.inventory.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('inventory-item');
                itemDiv.innerHTML = `
                    <div class="item-name">${item.name}</div>
                    <div class="item-stats">+${item.damage || item.defense || 0} ${item.damage ? 'Damage' : 'Defense'}</div>
                    <button onclick="equipItem('${item._id}', '${item.type}')">Equip</button>
                `;
                inventoryItemsContainer.appendChild(itemDiv);
            });
        } else {
            inventoryItemsContainer.innerHTML = '<div class="empty-inventory">Your inventory is empty</div>';
        }
    }
}

function equipItem(itemId, itemType) {
    socket.emit('equipItem', { itemId, itemType });
}

function clearGameContainer() {
    gameLog.innerHTML = '';
    resetCombatSelections();
    waitingForOpponent = false;
    roundInProgress = false;
    if (combatControls) combatControls.style.opacity = '1';
}

function updateStatValues(data) {
    if (data.stats) {
        const strengthElements = document.querySelectorAll('.strength-value');
        const agilityElements = document.querySelectorAll('.agility-value');
        const intuitionElements = document.querySelectorAll('.intuition-value');
        const enduranceElements = document.querySelectorAll('.endurance-value');
        
        strengthElements.forEach(el => el.textContent = data.stats.strength);
        agilityElements.forEach(el => el.textContent = data.stats.agility);
        intuitionElements.forEach(el => el.textContent = data.stats.intuition);
        enduranceElements.forEach(el => el.textContent = data.stats.endurance);
    }
    
    if (data.stats) {
        const winsElements = document.querySelectorAll('.wins-count');
        const lossesElements = document.querySelectorAll('.losses-count');
        
        winsElements.forEach(el => el.textContent = data.stats.totalWins || 0);
        lossesElements.forEach(el => el.textContent = data.stats.totalLosses || 0);
        
        const totalGames = (data.stats.totalWins || 0) + (data.stats.totalLosses || 0);
        const winRate = totalGames > 0 ? Math.round((data.stats.totalWins / totalGames) * 100) : 0;
        const winrateElements = document.querySelectorAll('.winrate-value');
        winrateElements.forEach(el => el.textContent = `${winRate}%`);
    }
    
    if (data.level) {
        const levelElements = document.querySelectorAll('.level-indicator, .rank-value-card');
        levelElements.forEach(el => el.textContent = `LVL ${data.level}`);
        
        const rankElements = document.querySelectorAll('.profile-rank');
        let rankTitle = 'New Player';
        if (data.level >= 20) rankTitle = 'Master';
        else if (data.level >= 15) rankTitle = 'Expert';
        else if (data.level >= 10) rankTitle = 'Veteran';
        else if (data.level >= 5) rankTitle = 'Experienced';
        
        rankElements.forEach(el => el.textContent = rankTitle);
    }
}

// Socket event handlers
socket.on('connect', () => {
    myPlayerId = socket.id;
    console.log('✅ Socket connected successfully. Socket ID:', socket.id);
});

socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    if (err.message.includes('Authentication error')) {
        console.error('Socket authentication failed. Token might be invalid or expired.');
        alert('Session expired or invalid. Please log in again.');
        logout();
    }
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
});

socket.on('authenticated', (data) => {
    if (data.user && currentUser) {
        currentUser = {...currentUser, ...data.user};
        updateProfileDisplay(currentUser);
    }
    if (window.cleanupDisplacedIcons) window.cleanupDisplacedIcons();
});

socket.on('authError', (error) => {
    console.error('Custom "authError" event:', error);
    alert(`Authentication failed: ${error.message || error}. Please log in again.`);
    logout();
});

socket.on('updatePlayerList', (players) => {
    console.log("📡 Received 'updatePlayerList' event with", players.length, "players");
    updatePlayersList(players);
});

socket.on('challengeReceived', updateIncomingChallenges);
socket.on('challengeSent', addOutgoingChallenge);
socket.on('challengeAccepted', startGame);

socket.on('challengeRejected', (data) => {
    const outgoingChallenge = document.getElementById(`outgoing-${data.challengeId}`);
    if (outgoingChallenge) outgoingChallenge.remove();
    alert(data.message);
});

socket.on('gameStarted', (data) => {
    updateGameState(data.gameState);
    addLogEntry('Game started! Prepare for battle!', 'info');
});

socket.on('roundStarted', (data) => {
    roundInProgress = false;
    waitingForOpponent = false;
    if (combatControls) {
        combatControls.style.display = 'flex';
        combatControls.style.opacity = '1';
    }
    resetCombatSelections();
    startTurnTimer(data.turnTime);
    addLogEntry(`Round ${data.round} started!`, 'info');
    showGameMessage('choose-move');
});

socket.on('moveReceived', (data) => {
    stopTurnTimer();
});

socket.on('opponentMadeMove', () => {
    const opponentName = opponentInfo ? opponentInfo.name : 'Opponent';
    addLogEntry(`${opponentName} has made their move`, 'info');
});

// FIXED: Added the missing allMovesMade event handler
socket.on('allMovesMade', (data) => {
    console.log('All moves received, processing round...');
    roundInProgress = true;
    waitingForOpponent = false;
    
    // Show processing message
    showGameMessage('processing');
    if (combatControls) combatControls.style.opacity = '0.5';
    
    addLogEntry('Processing moves...', 'info');
});

socket.on('roundResult', (data) => {
    updateGameState(data.gameState);
    showCombatResult(data);
    data.combatLog.forEach(log => {
        addLogEntry(log.message, log.type === 'hit' ? 'damage' : 'info');
    });
});

socket.on('gameOver', (result) => {
    handleGameEnd(result);
});

socket.on('profileData', (data) => {
    console.log('Profile data received from server:', data);
    if(currentUser && data.user) {
        currentUser = {...currentUser, ...data.user};
    }
    if (window.updateLobbyStats) {
        window.updateLobbyStats(data);
    } else {
        updateStatValues(data);
    }
    updateProfileDisplay(data.user || currentUser);
});

socket.on('statsUpdate', (stats) => {
    console.log('Stats update received:', stats);
    updateStatValues({ stats });
});

socket.on('inventory', updateInventoryDisplay);

socket.on('equipmentUpdated', (data) => {
    updateInventoryDisplay(data);
    const slot = document.querySelector(`.${data.slotType}-slot`);
    if (slot) {
        animateEquipItem(slot);
    }
});

socket.on('purchaseComplete', (data) => {
    alert(`Successfully purchased ${data.itemName}!`);
    socket.emit('getInventory');
});

socket.on('purchaseFailed', (data) => {
    alert(data.message);
});

socket.on('shopItems', (items) => {
    shopData = items;
    displayShopItems('weapons');
});

// Make buyItem and equipItem global so they can be called from HTML onclick
window.buyItem = buyItem;
window.equipItem = equipItem;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);