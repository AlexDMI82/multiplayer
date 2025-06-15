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
        updateEquipmentDisplay(); // This needs to be called to get item data
        updateStatsUI(); // Call again to update calculations with item data
    }
}


function getCharacterBonuses(characterClass) {
    const bonuses = {
        shadowsteel: { strength: 3, agility: 7, intuition: 0, endurance: 0, specialAbility: 'evade' },
        ironbound: { strength: 5, agility: 0, intuition: 0, endurance: 5, specialAbility: 'ignoreBlock' },
        flameheart: { strength: 3, agility: 0, intuition: 7, endurance: 0, specialAbility: 'criticalHit' },
        venomfang: { strength: 5, agility: 5, intuition: 0, endurance: 0, specialAbility: 'poison' }
    };
    return bonuses[characterClass] || { strength: 0, agility: 0, intuition: 0, endurance: 0 };
}


function updateStatsUI() {
    if (!playerStats || !playerData) return;

    const classBonuses = getCharacterBonuses(playerData.characterClass);

    // --- 1. Calculate all bonuses from equipped items dynamically ---
    let itemBonuses = {
        health: 0, damage: 0, criticalChance: 0, evasionChance: 0,
        strength: 0, agility: 0, intuition: 0, endurance: 0
    };
    let healthBreakdownLines = [];
    let attackBreakdownLines = [];

    if (playerInventory && playerInventory.equipped) {
        for (const item of Object.values(playerInventory.equipped)) {
            if (item && item.bonuses) {
                if(item.bonuses.health) {
                    itemBonuses.health += item.bonuses.health;
                    healthBreakdownLines.push(`<li>From ${item.name}: <span>+${item.bonuses.health}</span></li>`);
                }
                if(item.bonuses.damage) {
                    itemBonuses.damage += item.bonuses.damage;
                    attackBreakdownLines.push(`<li>From ${item.name}: <span>+${item.bonuses.damage}</span></li>`);
                }
                // Add more for other stats as needed (e.g., crit, evade)
                itemBonuses.criticalChance += item.bonuses.criticalChance || 0;
                itemBonuses.evasionChance += item.bonuses.evasionChance || 0;
            }
        }
    }

    // --- 2. Update Base Stat Display with Tooltips ---
    const statsToUpdate = ['strength', 'agility', 'intuition', 'endurance'];
    statsToUpdate.forEach(stat => {
        const totalValue = playerStats[stat] || 10;
        const classBonus = classBonuses[stat] || 0;
        const itemBonus = itemBonuses[stat] || 0;
        const baseValue = totalValue - classBonus - itemBonus;

        document.getElementById(`${stat}-value`).textContent = baseValue;
        const bonusEl = document.getElementById(`${stat}-bonus`);
        const totalBonus = classBonus + itemBonus;
        bonusEl.textContent = totalBonus > 0 ? `(+${totalBonus})` : '';

        const tooltipEl = document.getElementById(`${stat}-tooltip`);
        tooltipEl.innerHTML = `
            <ul>
                <li>Base Points: <span>${baseValue}</span></li>
                <li>Class Bonus: <span>+${classBonus}</span></li>
                <li>Item Bonus: <span>+${itemBonus}</span></li>
                <hr>
                <li><strong>Total:</strong> <span><strong>${totalValue}</strong></span></li>
            </ul>
        `;
    });
    
    availablePointsElement.textContent = playerStats.availablePoints || 0;

    // --- 3. Update Calculated Combat Stats with Dynamic Breakdowns ---
    const totalStrength = playerStats.strength || 10;
    const totalAgility = playerStats.agility || 10;
    const totalIntuition = playerStats.intuition || 10;
    const totalEndurance = playerStats.endurance || 10;

    // Attack
    const weaponDamage = playerInventory?.equipped?.weapon?.damage || 0;
    const baseAttack = totalStrength * 2;
    const totalAttack = baseAttack + weaponDamage + itemBonuses.damage;
    document.getElementById('total-attack-value').textContent = totalAttack;
    document.getElementById('attack-breakdown-list').innerHTML = `
        <li>From Strength: <span>${baseAttack}</span></li>
        <li>From Weapon: <span>+${weaponDamage}</span></li>
        ${attackBreakdownLines.join('')}
    `;

    // Health
    const BASE_HEALTH = 200;
    const enduranceHealth = (totalEndurance > 10) ? (totalEndurance - 10) * 10 : 0;
    const totalHealth = BASE_HEALTH + enduranceHealth + itemBonuses.health;
    document.getElementById('total-health-value').textContent = `${totalHealth} HP`;
    document.getElementById('health-breakdown-list').innerHTML = `
        <li>Base: <span>${BASE_HEALTH}</span></li>
        <li>From Endurance: <span>+${enduranceHealth}</span></li>
        ${healthBreakdownLines.join('')}
    `;

    // Evade Chance (now includes item bonuses)
    const baseEvade = totalAgility * 0.5;
    const classEvadeBonus = playerData.characterClass === 'shadowsteel' ? 5 : 0;
    evadeChanceElement.innerHTML = `${baseEvade + classEvadeBonus + itemBonuses.evasionChance}%`;

    // Critical Chance (now includes item bonuses)
    const baseCrit = totalIntuition * 0.5;
    const classCritBonus = playerData.characterClass === 'flameheart' ? 5 : 0;
    criticalChanceElement.innerHTML = `${baseCrit + classCritBonus + itemBonuses.criticalChance}%`;

    // Record Stats (no change needed here)
    totalWinsElement.textContent = playerStats.totalWins || 0;
    // ... rest of record stats ...
    const totalGames = (playerStats.totalWins || 0) + (playerStats.totalLosses || 0);
    const winRate = totalGames > 0 ? Math.round(((playerStats.totalWins || 0) / totalGames) * 100) : 0;
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