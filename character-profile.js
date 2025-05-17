
// Connect to Socket.io server
const socket = io({
    autoConnect: false // Prevent auto-connection, we'll connect after auth
});

// DOM Elements
const characterNameElement = document.getElementById('character-name');
const characterAvatarElement = document.getElementById('character-avatar');
const characterClassElement = document.getElementById('character-class');
const characterSubclassElement = document.getElementById('character-subclass');
const playerLevelElement = document.getElementById('player-level');
const playerWinsElement = document.getElementById('player-wins');
const winsForLevelElement = document.getElementById('wins-for-level');
const levelProgressFillElement = document.getElementById('level-progress-fill');

// Stats Elements
const strengthValueElement = document.getElementById('strength-value');
const agilityValueElement = document.getElementById('agility-value');
const intuitionValueElement = document.getElementById('intuition-value');
const enduranceValueElement = document.getElementById('endurance-value');
const availablePointsElement = document.getElementById('available-points');

// Calculated Stats Elements
const attackValueElement = document.getElementById('attack-value');
const evadeChanceElement = document.getElementById('evade-chance');
const criticalChanceElement = document.getElementById('critical-chance');
const healthValueElement = document.getElementById('health-value');
const totalWinsElement = document.getElementById('total-wins');
const totalLossesElement = document.getElementById('total-losses');
const winRateElement = document.getElementById('win-rate');

// Equipment Elements
const helmetNameElement = document.getElementById('helmet-name');
const weaponNameElement = document.getElementById('weapon-name');
const armorNameElement = document.getElementById('armor-name');
const shieldNameElement = document.getElementById('shield-name');

// Inventory Modal Elements
const inventoryModal = document.getElementById('inventory-modal');
const equippedWeapon = document.getElementById('equipped-weapon');
const equippedArmor = document.getElementById('equipped-armor');
const equippedShield = document.getElementById('equipped-shield');
const equippedHelmet = document.getElementById('equipped-helmet');
const inventoryItemsContainer = document.getElementById('inventory-items-container');
const playerGoldSpan = document.getElementById('player-gold');

// Navigation buttons
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const openInventoryBtn = document.getElementById('open-inventory-btn');
const openShopBtn = document.getElementById('open-shop-btn');
const logoutBtn = document.getElementById('logout-btn');
const closeInventoryBtn = document.getElementById('close-inventory');

// Stat increase buttons
const statIncreaseButtons = document.querySelectorAll('.stat-increase');

// Constants
const WINS_PER_LEVEL = 10;
const POINTS_PER_LEVEL = 5;

// Character class constants
const CHARACTER_CLASSES = {
    shadowsteel: {
        name: 'Shadowsteel',
        subclass: 'Shadow Warrior',
        bonuses: {
            strength: 3,
            agility: 7,
            intuition: 0,
            endurance: 0
        },
        specialAbility: 'evade'
    },
    ironbound: {
        name: 'Ironbound',
        subclass: 'Metal Berserker',
        bonuses: {
            strength: 5,
            agility: 0, 
            intuition: 0,
            endurance: 5
        },
        specialAbility: 'ignoreBlock'
    },
    flameheart: {
        name: 'Flameheart',
        subclass: 'Fire Warrior',
        bonuses: {
            strength: 3,
            agility: 0,
            intuition: 7,
            endurance: 0
        },
        specialAbility: 'criticalHit'
    },
    venomfang: {
        name: 'Venomfang',
        subclass: 'Poison Assassin',
        bonuses: {
            strength: 5,
            agility: 5,
            intuition: 0,
            endurance: 0
        },
        specialAbility: 'poison'
    }
};

// State
let playerData = null;
let playerStats = null;
let playerInventory = null;
let isLoadingData = false;

// Initialize
document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const userData = JSON.parse(userStr);
        playerData = userData;
        
        // Set up socket connection
        setupSocketConnection(token);
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial user data and apply character class
        loadUserData();
    } catch (error) {
        console.error('Error initializing profile page:', error);
        window.location.href = '/login.html';
    }
}

function setupSocketConnection(token) {
    // Set token and connect
    socket.auth = { token };
    socket.connect();
    
    // Socket event handlers
    socket.on('connect', () => {
        console.log('Connected to server');
        // Authenticate with token
        socket.emit('authenticate', token);
    });
    
    socket.on('authenticated', (data) => {
        console.log('Authentication successful:', data);
        // Request player profile data
        requestPlayerData();
    });
    
    socket.on('authError', (error) => {
        console.error('Authentication error:', error);
        window.location.href = '/login.html';
    });
    
    socket.on('profileData', (data) => {
        console.log('Received profile data:', data);
        updateProfileUI(data);
    });
    
    socket.on('statsUpdate', (stats) => {
        console.log('Received stats update:', stats);
        playerStats = stats;
        updateStatsUI();
    });
    
    socket.on('inventory', (inventory) => {
        console.log('Received inventory update:', inventory);
        playerInventory = inventory;
        updateInventoryUI();
    });
    
    socket.on('equipmentUpdated', (data) => {
        console.log('Equipment updated:', data);
        playerInventory = {
            gold: playerInventory.gold,
            equipped: data.equipped,
            inventory: data.inventory
        };
        updateInventoryUI();
        updateEquipmentDisplay();
    });
    
    socket.on('levelUp', (data) => {
        console.log('Level up!', data);
        showLevelUpNotification(data.level, data.bonusPoints);
        requestPlayerData(); // Refresh all data
    });
}

function setupEventListeners() {
    // Navigation
    backToLobbyBtn.addEventListener('click', () => {
        window.location.href = '/';
    });
    
    logoutBtn.addEventListener('click', logout);
    
    // Inventory and Shop
    openInventoryBtn.addEventListener('click', () => {
        socket.emit('getInventory');
        showModal(inventoryModal);
    });
    
    openShopBtn.addEventListener('click', () => {
        window.location.href = '/shop.html';
    });
    
    closeInventoryBtn.addEventListener('click', () => {
        hideModal(inventoryModal);
    });
    
    // Stat increase buttons
    statIncreaseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const stat = button.getAttribute('data-stat');
            increasePlayerStat(stat);
        });
    });
}

function logout() {
    fetch('/api/logout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    }).catch(err => console.error('Logout error:', err));
    
    // Disconnect socket
    socket.disconnect();
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login
    window.location.href = '/login.html';
}

function requestPlayerData() {
    if (isLoadingData) return;
    
    isLoadingData = true;
    
    // Get profile data
    socket.emit('getProfile');
    
    // Get stats
    socket.emit('requestStats');
    
    // Get inventory
    socket.emit('getInventory');
    
    setTimeout(() => {
        isLoadingData = false;
    }, 1000);
}

function loadUserData() {
    if (!playerData) return;
    
    // Set character name
    characterNameElement.textContent = playerData.username;
    
    // Set character class information
    if (playerData.characterClass) {
        // Get character class data
        const classData = CHARACTER_CLASSES[playerData.characterClass];
        
        // Set character image from the character class
        const characterImagePath = `images/characters/${playerData.characterClass}.png`;
        characterAvatarElement.src = characterImagePath;
        
        // Set character class style
        const characterOverview = document.getElementById('character-overview');
        // Clear existing classes
        characterOverview.className = 'character-overview';
        // Add character-specific class
        characterOverview.classList.add(playerData.characterClass);
        
        // Set character class and subclass if elements exist
        if (characterClassElement) {
            characterClassElement.textContent = classData.name;
        }
        
        if (characterSubclassElement) {
            characterSubclassElement.textContent = classData.subclass;
        }
    } else {
        // Fallback to avatar if no character class is selected
        const avatarSrc = playerData.avatar.startsWith('images/') ? 
            playerData.avatar : `images/${playerData.avatar}`;
        characterAvatarElement.src = avatarSrc;
    }
}

function updateProfileUI(data) {
    // Update player level and progress
    const level = data.level || 1;
    const wins = data.wins || 0;
    const winsForNextLevel = level * WINS_PER_LEVEL;
    const progress = Math.min(100, (wins % WINS_PER_LEVEL) / WINS_PER_LEVEL * 100);
    
    playerLevelElement.textContent = level;
    playerWinsElement.textContent = wins;
    winsForLevelElement.textContent = WINS_PER_LEVEL;
    levelProgressFillElement.style.width = `${progress}%`;
    
    // Update character profile user data if needed
    if (data.user) {
        playerData = data.user;
        loadUserData();
    }
    
    // If we have stats data, update it
    if (data.stats) {
        playerStats = data.stats;
        updateStatsUI();
    }
    
    // If we have inventory data, update it
    if (data.inventory) {
        playerInventory = data.inventory;
        updateInventoryUI();
        updateEquipmentDisplay();
    }
}

function updateStatsUI() {
    if (!playerStats) return;
    
    // Get character bonuses
    let characterBonuses = { strength: 0, agility: 0, intuition: 0, endurance: 0 };
    
    if (playerData && playerData.characterClass) {
        characterBonuses = CHARACTER_CLASSES[playerData.characterClass].bonuses;
    }
    
    // Update base stats (now we are showing the actual stats with bonuses already applied)
    strengthValueElement.textContent = playerStats.strength || 10;
    agilityValueElement.textContent = playerStats.agility || 10;
    intuitionValueElement.textContent = playerStats.intuition || 10;
    enduranceValueElement.textContent = playerStats.endurance || 10;
    availablePointsElement.textContent = playerStats.availablePoints || 0;
    
    // Update calculated stats
    const baseAttack = 0; // Base attack value
    const strengthBonus = (playerStats.strength || 10) * 2; // 2 damage per strength point
    let totalAttack = baseAttack + strengthBonus;
    
    // Add weapon damage if equipped
    if (playerInventory && playerInventory.equipped && playerInventory.equipped.weapon) {
        totalAttack += playerInventory.equipped.weapon.damage || 0;
    }
    
    attackValueElement.textContent = totalAttack;
    evadeChanceElement.textContent = `${playerStats.agility || 10}%`;
    criticalChanceElement.textContent = `${playerStats.intuition || 10}%`;
    
    // Calculate max health
    const baseHealth = 100;
    const enduranceBonus = (playerStats.endurance || 10) * 10; // 10 HP per endurance point
    healthValueElement.textContent = `${baseHealth + enduranceBonus} HP`;
    
    // Update record stats
    totalWinsElement.textContent = playerStats.totalWins || 0;
    totalLossesElement.textContent = playerStats.totalLosses || 0;
    
    // Calculate win rate
    const totalGames = (playerStats.totalWins || 0) + (playerStats.totalLosses || 0);
    const winRate = totalGames > 0 ? Math.round((playerStats.totalWins / totalGames) * 100) : 0;
    winRateElement.textContent = `${winRate}%`;
    
    // Enable/disable stat increase buttons
    updateStatButtons();
}

function updateStatButtons() {
    const availablePoints = playerStats.availablePoints || 0;
    
    // Disable all buttons if no points available
    statIncreaseButtons.forEach(button => {
        button.disabled = availablePoints <= 0;
    });
}

function increasePlayerStat(stat) {
    if (!playerStats || playerStats.availablePoints <= 0) return;
    
    // Create updated stats object
    const updatedStats = {
        ...playerStats,
        [stat]: playerStats[stat] + 1,
        availablePoints: playerStats.availablePoints - 1
    };
    
    // Send update to server
    socket.emit('updateStats', updatedStats);
}

function updateInventoryUI() {
    if (!playerInventory) return;
    
    // Update gold
    playerGoldSpan.textContent = playerInventory.gold;
    
    // Update equipped items in inventory modal
    equippedWeapon.textContent = playerInventory.equipped.weapon ? playerInventory.equipped.weapon.name : 'None';
    equippedArmor.textContent = playerInventory.equipped.armor ? playerInventory.equipped.armor.name : 'None';
    equippedShield.textContent = playerInventory.equipped.shield ? playerInventory.equipped.shield.name : 'None';
    equippedHelmet.textContent = playerInventory.equipped.helmet ? playerInventory.equipped.helmet.name : 'None';
    
    // Update inventory items
    inventoryItemsContainer.innerHTML = '';
    
    if (playerInventory.inventory.length === 0) {
        inventoryItemsContainer.innerHTML = '<div class="empty-inventory">No items</div>';
        return;
    }
    
    playerInventory.inventory.forEach(item => {
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

function updateEquipmentDisplay() {
    if (!playerInventory) return;
    
    // Update equipment display
    weaponNameElement.textContent = playerInventory.equipped.weapon ? playerInventory.equipped.weapon.name : 'None';
    armorNameElement.textContent = playerInventory.equipped.armor ? playerInventory.equipped.armor.name : 'None';
    shieldNameElement.textContent = playerInventory.equipped.shield ? playerInventory.equipped.shield.name : 'None';
    helmetNameElement.textContent = playerInventory.equipped.helmet ? playerInventory.equipped.helmet.name : 'None';
    
    // Update equipment quality classes
    updateEquipmentQualityClass('weapon', playerInventory.equipped.weapon);
    updateEquipmentQualityClass('armor', playerInventory.equipped.armor);
    updateEquipmentQualityClass('shield', playerInventory.equipped.shield);
    updateEquipmentQualityClass('helmet', playerInventory.equipped.helmet);
    
    // Update combat stats since equipment affects them
    updateStatsUI();
}

function updateEquipmentQualityClass(type, item) {
    let slotElement;
    
    switch (type) {
        case 'weapon':
            slotElement = document.querySelector('.sword-slot');
            break;
        case 'armor':
            slotElement = document.querySelector('.armor-slot');
            break;
        case 'shield':
            slotElement = document.querySelector('.shield-slot');
            break;
        case 'helmet':
            slotElement = document.querySelector('.helmet-slot');
            break;
    }
    
    if (!slotElement) return;
    
    // Reset classes
    slotElement.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');
    
    if (!item) return;
    
    // Add equipped class
    slotElement.classList.add('equipped');
    
    // Determine quality class based on stats
    let quality = 'common';
    const statValue = type === 'weapon' ? item.damage : item.defense;
    
    if (statValue >= 15) quality = 'legendary';
    else if (statValue >= 10) quality = 'epic';
    else if (statValue >= 8) quality = 'rare';
    else if (statValue >= 5) quality = 'uncommon';
    
    slotElement.classList.add(quality);
}

function equipItem(itemId, itemType) {
    socket.emit('equipItem', { itemId, itemType });
}

function showLevelUpNotification(level, bonusPoints) {
    // Create notification element
    const notification = document.createElement('div');
    notification.classList.add('level-up-notification');
    notification.innerHTML = `
        <h3>Level Up!</h3>
        <p>You are now level ${level}!</p>
        <p>You received ${bonusPoints} bonus stat points!</p>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// Helper function to show modal
function showModal(modal) {
    modal.classList.remove('hidden');
}

// Helper function to hide modal
function hideModal(modal) {
    modal.classList.add('hidden');
}