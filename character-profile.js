// Connect to Socket.io server
const socket = io({
    autoConnect: false // Prevent auto-connection, we'll connect after auth
});

// DOM Elements
const characterNameElement = document.getElementById('character-name');
const characterAvatarElement = document.getElementById('character-avatar');
const characterClassElement = document.getElementById('character-class');
const characterSubclassElement = document.getElementById('character-subclass');

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

// Navigation buttons
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const openInventoryBtn = document.getElementById('open-inventory-btn');
const openShopBtn = document.getElementById('open-shop-btn');
const logoutBtn = document.getElementById('logout-btn');

// Stat increase buttons
const statIncreaseButtons = document.querySelectorAll('.stat-increase');

// Character class constants
const CHARACTER_CLASSES = {
    shadowsteel: { name: 'Shadowsteel', subclass: 'Shadow Warrior' },
    ironbound: { name: 'Ironbound', subclass: 'Metal Berserker' },
    flameheart: { name: 'Flameheart', subclass: 'Fire Warrior' },
    venomfang: { name: 'Venomfang', subclass: 'Poison Assassin' }
};

// Image fallback system
const FALLBACK_IMAGES = {
    weapon: 'images/slot-sword.svg',
    armor: 'images/slot-armor.svg',
    shield: 'images/slot-shield.svg',
    helmet: 'images/slot-helmet.svg',
    boots: 'images/slot-boots.svg',
    gloves: 'images/slot-gloves.svg',
    amulet: 'images/slot-amulet.svg',
    ring: 'images/slot-ring.svg'
};

// State
let playerData = null;
let playerStats = null;
let playerInventory = null;
let isLoadingData = false;

// Initialize
document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        window.location.href = '/login.html';
        return;
    }
    
    try {
        playerData = JSON.parse(userStr);
        setupSocketConnection(token);
        setupEventListeners();
        loadUserData();
        
        setInterval(() => {
            if (!isLoadingData) requestPlayerData();
        }, 5000);

    } catch (error) {
        console.error('Error initializing profile page:', error);
        window.location.href = '/login.html';
    }
}

function setupSocketConnection(token) {
    socket.auth = { token };
    socket.connect();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        requestPlayerData();
    });
    
    socket.on('profileData', (data) => {
        console.log('Received profile data:', data);
        updateProfileUI(data);
    });

    socket.on('profileDataUpdate', (data) => {
        console.log('Received real-time profile UPDATE:', data);
        updateProfileUI(data);
    });
    
    socket.on('statsUpdate', (stats) => {
        playerStats = stats;
        updateStatsUI();
    });
    
    socket.on('inventory', (inventory) => {
        playerInventory = inventory;
        updateEquipmentDisplay();
    });

    socket.on('equipmentUpdated', (data) => {
        playerInventory = {
            gold: playerInventory?.gold || data.gold || 0,
            equipped: data.equipped,
            inventory: data.inventory
        };
        updateEquipmentDisplay();
        if (data.slotType) {
            const slotElement = document.querySelector(`.${data.slotType}-slot`);
            if (slotElement) animateEquipItem(slotElement);
        }
    });
    
    socket.on('levelUp', (data) => {
        showLevelUpNotification(data.level, data.bonusPoints);
        requestPlayerData();
    });

    socket.on('statUpdated', (data) => {
        if (data.stats) {
            playerStats = data.stats;
            updateStatsUI();
        }
    });
}

function setupEventListeners() {
    backToLobbyBtn.addEventListener('click', () => { window.location.href = '/'; });
    logoutBtn.addEventListener('click', logout);
    openShopBtn.addEventListener('click', () => { window.location.href = '/shop.html'; });

    // This now calls the modern inventory system
    openInventoryBtn.addEventListener('click', () => {
        if (window.modernInventorySystem && typeof window.modernInventorySystem.openInventory === 'function') {
            window.modernInventorySystem.openInventory();
        } else {
            console.error("Modern inventory system not found. Make sure modern-inventory.js is loaded.");
        }
    });
    
    statIncreaseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const stat = button.getAttribute('data-stat');
            increasePlayerStat(stat);
        });
    });
}

function logout() {
    fetch('/api/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }})
        .catch(err => console.error('Logout error:', err));
    socket.disconnect();
    localStorage.clear();
    window.location.href = '/login.html';
}

function requestPlayerData() {
    if (isLoadingData) return;
    isLoadingData = true;
    socket.emit('getProfile');
    setTimeout(() => { isLoadingData = false; }, 1000);
}

function loadUserData() {
    if (!playerData) return;
    
    const headerPlayerName = document.getElementById('header-player-name');
    if(headerPlayerName) headerPlayerName.textContent = playerData.username || 'Character Profile';

    if (playerData.characterClass) {
        const classData = CHARACTER_CLASSES[playerData.characterClass];
        if (characterAvatarElement) characterAvatarElement.src = `images/characters/${playerData.characterClass}.png`;
        const characterOverview = document.getElementById('character-overview');
        if(characterOverview) {
            characterOverview.className = 'character-overview';
            characterOverview.classList.add(playerData.characterClass);
        }
        if (characterClassElement) characterClassElement.textContent = classData.name;
        if (characterSubclassElement) characterSubclassElement.textContent = classData.subclass;
    } else if(characterAvatarElement) {
        characterAvatarElement.src = playerData.avatar?.startsWith('images/') ? playerData.avatar : `images/${playerData.avatar || 'default-avatar.png'}`;
    }
}

function updateProfileUI(data) {
    const BASE_XP_TO_LEVEL = 1000;
    const XP_INCREASE_PER_LEVEL = 200;

    function getTotalXPForLevel(level) {
        if (level <= 1) return 0;
        let totalXP = 0;
        for (let i = 2; i <= level; i++) {
            totalXP += BASE_XP_TO_LEVEL + (i - 2) * XP_INCREASE_PER_LEVEL;
        }
        return totalXP;
    }

    function getXPForNextLevelUp(currentLevel) {
        return BASE_XP_TO_LEVEL + (currentLevel - 1) * XP_INCREASE_PER_LEVEL;
    }

    if (data.playerLevel) {
        const level = data.playerLevel.level || 1;
        const totalXP = data.playerLevel.totalXP || 0;
        document.getElementById('profile-level-number').textContent = level;
        const xpForCurrentLevel = getTotalXPForLevel(level);
        const xpForNextLevelUp = getXPForNextLevelUp(level);
        const currentLevelXP = totalXP - xpForCurrentLevel;
        const xpPercentage = xpForNextLevelUp > 0 ? (currentLevelXP / xpForNextLevelUp) * 100 : 100;
        document.getElementById('profile-xp-fill').style.width = `${Math.min(100, xpPercentage)}%`;
        document.getElementById('profile-xp-text').textContent = `${currentLevelXP} / ${xpForNextLevelUp} XP`;
    }

    if (data.user) {
        playerData = data.user;
        loadUserData();
    }
    if (data.stats) {
        playerStats = data.stats;
        updateStatsUI();
    }
    if (data.inventory) {
        playerInventory = data.inventory;
        updateEquipmentDisplay();
    }
}

function updateStatsUI() {
    if (!playerStats) return;

    strengthValueElement.textContent = playerStats.strength || 10;
    agilityValueElement.textContent = playerStats.agility || 10;
    intuitionValueElement.textContent = playerStats.intuition || 10;
    enduranceValueElement.textContent = playerStats.endurance || 10;
    availablePointsElement.textContent = playerStats.availablePoints || 0;

    let totalAttack = (playerStats.strength || 10) * 2;
    if (playerInventory?.equipped?.weapon) {
        totalAttack += playerInventory.equipped.weapon.damage || 0;
    }
    attackValueElement.textContent = totalAttack;
    evadeChanceElement.textContent = `${(playerStats.agility || 10) * 0.5}%`;
    criticalChanceElement.textContent = `${(playerStats.intuition || 10) * 0.5}%`;
    healthValueElement.textContent = `${200 + ((playerStats.endurance || 10) * 10)} HP`;

    totalWinsElement.textContent = playerStats.totalWins || 0;
    totalLossesElement.textContent = playerStats.totalLosses || 0;
    const totalGames = (playerStats.totalWins || 0) + (playerStats.totalLosses || 0);
    const winRate = totalGames > 0 ? Math.round((playerStats.totalWins / totalGames) * 100) : 0;
    winRateElement.textContent = `${winRate}%`;

    updateStatButtons();
}

function updateStatButtons() {
    const availablePoints = playerStats?.availablePoints || 0;
    statIncreaseButtons.forEach(button => {
        button.disabled = availablePoints <= 0;
    });
}

function increasePlayerStat(stat) {
    if (playerStats?.availablePoints > 0) {
        socket.emit('updateStat', { statType: stat });
        playerStats[stat] += 1;
        playerStats.availablePoints -= 1;
        updateStatsUI();
    }
}

function updateEquipmentSlotDisplay(slotType, equippedItem) {
    const slotElement = document.querySelector(`#character-overview .${slotType}-slot`);
    if (!slotElement) return;

    const slotIcon = slotElement.querySelector('.slot-icon');
    const itemNameElement = slotElement.querySelector('.equipment-name');
    if (!slotIcon || !itemNameElement) return;

    slotElement.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');

    if (equippedItem) {
        itemNameElement.textContent = equippedItem.name;
        slotElement.classList.add('equipped');
        if (equippedItem.rarity) slotElement.classList.add(equippedItem.rarity);
        
        const statText = equippedItem.damage ? `+${equippedItem.damage} Damage` : equippedItem.defense ? `+${equippedItem.defense} Defense` : '';
        slotElement.title = `${equippedItem.name}\n${equippedItem.description || ''}\n${statText}`;
        
        slotIcon.src = equippedItem.image || FALLBACK_IMAGES[slotType];
        slotIcon.onerror = () => { slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg'; };
    } else {
        itemNameElement.textContent = 'None';
        slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg';
        slotIcon.onerror = null;
        slotElement.title = `${slotType.charAt(0).toUpperCase() + slotType.slice(1)} Slot`;
    }
}

function updateEquipmentDisplay() {
    if (!playerInventory) return;
    const equipmentSlots = ['weapon', 'armor', 'shield', 'helmet', 'boots', 'gloves', 'amulet', 'ring'];
    equipmentSlots.forEach(slotType => {
        const equippedItem = playerInventory.equipped[slotType];
        updateEquipmentSlotDisplay(slotType, equippedItem);
    });
    updateStatsUI();
}

function animateEquipItem(slotElement) {
    slotElement.classList.add('just-equipped');
    setTimeout(() => { slotElement.classList.remove('just-equipped'); }, 1000);
}

function showLevelUpNotification(level, bonusPoints) {
    const notification = document.createElement('div');
    notification.classList.add('level-up-notification');
    notification.innerHTML = `<h3>Level Up!</h3><p>You are now level ${level}!</p><p>You received ${bonusPoints} bonus stat points!</p>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => { notification.remove(); }, 500);
    }, 3000);
}