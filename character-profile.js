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
const amuletNameElement = document.getElementById('amulet-name');
const ringNameElement = document.getElementById('ring-name');
const bootsNameElement = document.getElementById('boots-name');
const glovesNameElement = document.getElementById('gloves-name');

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
        const userData = JSON.parse(userStr);
        playerData = userData;
        
        setupSocketConnection(token);
        setupEventListeners();
        loadUserData();
        
        // --- CHANGED: Start an auto-refresh interval as a fallback ---
        // This ensures data is refreshed even if an event is missed.
        setInterval(() => {
            console.log('Auto-refreshing profile data...');
            requestPlayerData();
        }, 5000); // Refresh every 5 seconds

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
        requestPlayerData(); // Initial data fetch on connect
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
        console.log('Received initial profile data:', data);
        updateProfileUI(data);
    });

   socket.on('profileDataUpdate', (data) => {
        console.log('Received real-time profile UPDATE:', data);
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
        updateEquipmentDisplay();
    });
    
    socket.on('equipmentUpdated', (data) => {
        console.log('Equipment updated:', data);
        playerInventory = {
            gold: playerInventory?.gold || data.gold || 0,
            equipped: data.equipped,
            inventory: data.inventory
        };
        updateInventoryUI();
        updateEquipmentDisplay();
        
        // Add animation to the updated slot
        if (data.slotType) {
            const slotElement = document.querySelector(`.${data.slotType}-slot`);
            if (slotElement) {
                animateEquipItem(slotElement);
            }
        }
    });
    
    socket.on('levelUp', (data) => {
        console.log('Level up!', data);
        showLevelUpNotification(data.level, data.bonusPoints);
        requestPlayerData(); // Refresh all data
    });

    socket.on('statUpdated', (data) => {
        console.log('Stat updated:', data);
        // Update playerStats with the new values from server
        if (data.stats) {
            playerStats = data.stats;
            updateStatsUI();
        }
    });

    socket.on('statsUpdateFailed', (data) => {
        console.error('Failed to update stat:', data.message);
        // Refresh stats from server to correct optimistic update
        socket.emit('requestStats');
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

function setupEquipmentSlotHandlers() {
    const equipmentSlots = document.querySelectorAll('.equipment-slot');
    console.log(`🎯 Setting up handlers for ${equipmentSlots.length} equipment slots`);
    
    equipmentSlots.forEach(slot => {
        slot.addEventListener('click', () => {
            // Determine slot type from class name
            let slotType = '';
            const classes = Array.from(slot.classList);
            for (const className of classes) {
                if (className.endsWith('-slot') && className !== 'equipment-slot') {
                    slotType = className.replace('-slot', '');
                    break;
                }
            }
            
            // Handle special cases
            if (slotType === 'sword') slotType = 'weapon';
            
            console.log(`🖱️ Equipment slot clicked: ${slotType}`);
            
            // Open inventory modal
            if (slotType) {
                socket.emit('getInventory');
                showModal(inventoryModal);
                
                // Highlight compatible items after inventory loads
                setTimeout(() => {
                    highlightCompatibleItems(slotType);
                }, 500);
            }
        });
    });
}

function highlightCompatibleItems(targetSlotType) {
    const inventoryItems = document.querySelectorAll('.inventory-item');
    inventoryItems.forEach(item => {
        const equipBtn = item.querySelector('.equip-btn');
        const itemType = equipBtn ? equipBtn.getAttribute('data-type') : '';
        
        // Add highlighting for compatible items
        if (itemType === targetSlotType) {
            item.classList.add('compatible-item');
        } else {
            item.classList.remove('compatible-item');
        }
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
    // Helper functions for XP calculation
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

    // Update player level and progress using the playerLevel object from the server
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
    
    // Fallback for old win-based system if totalXP is not present
    else if(data.stats && data.stats.totalWins !== undefined) {
        const wins = data.stats.totalWins || 0;
        const winsForNextLevel = 10;
        const progress = Math.min(100, (wins % winsForNextLevel) / winsForNextLevel * 100);
        document.getElementById('profile-level-number').textContent = data.level || 1;
        document.getElementById('profile-xp-fill').style.width = `${progress}%`;
        document.getElementById('profile-xp-text').textContent = `${wins % winsForNextLevel} / ${winsForNextLevel} Wins`;
    }

    // Update other parts of the UI
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
    evadeChanceElement.textContent = `${(playerStats.agility || 10) * 0.5}%`;
    criticalChanceElement.textContent = `${(playerStats.intuition || 10) * 0.5}%`;
    
    // Calculate max health
    const baseHealth = 200;
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
    
    // Send just the stat type to increase, not the entire stats object
    socket.emit('updateStat', {
        statType: stat
    });
    
    // Optimistically update the UI (will be corrected by server response)
    playerStats[stat] += 1;
    playerStats.availablePoints -= 1;
    updateStatsUI();
}

// --- CHANGED: This entire function is replaced with a more reliable version ---
// This new version avoids the unreliable `new Image()` preloader pattern.
function updateEquipmentSlotDisplay(slotType, equippedItem) {
    const slotElement = document.querySelector(`#character-overview .${slotType}-slot`);
    if (!slotElement) {
        console.warn(`Equipment slot not found in #character-overview: .${slotType}-slot`);
        return;
    }
    
    const slotIcon = slotElement.querySelector('.slot-icon');
    const itemNameElement = slotElement.querySelector('.equipment-name');
    
    if (!slotIcon || !itemNameElement) {
        console.warn(`Missing slot elements for ${slotType}`);
        return;
    }
    
    // Reset classes first
    slotElement.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');

    if (equippedItem) {
        // Item is equipped, update UI
        itemNameElement.textContent = equippedItem.name;
        slotElement.classList.add('equipped');
        if (equippedItem.rarity) {
            slotElement.classList.add(equippedItem.rarity);
        }

        const statText = equippedItem.damage ? `+${equippedItem.damage} Damage` : 
                       equippedItem.defense ? `+${equippedItem.defense} Defense` : '';
        slotElement.title = `${equippedItem.name}\n${equippedItem.description || ''}\n${statText}`;

        // Set the image source directly and add a fallback
        if (equippedItem.image) {
            slotIcon.src = equippedItem.image;
            slotIcon.onerror = () => {
                console.warn(`Failed to load item image: ${equippedItem.image}, using fallback.`);
                slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg';
            };
        } else {
            slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg';
        }
        console.log(`✅ Updated ${slotType} slot with ${equippedItem.name}`);
        
    } else {
        // No item equipped, reset to placeholder
        slotIcon.src = FALLBACK_IMAGES[slotType] || 'images/slot-default.svg';
        slotIcon.onerror = null; // Clear previous error handler
        slotIcon.alt = `${slotType} slot`;
        itemNameElement.textContent = 'None';
        slotElement.title = `${slotType.charAt(0).toUpperCase() + slotType.slice(1)} Slot`;
    }
}
// --- END OF CHANGED FUNCTION ---

function updateInventoryUI() {
    if (!playerInventory) return;
    
    // Update gold
    playerGoldSpan.textContent = playerInventory.gold;
    
    // Update equipped items in inventory modal
    equippedWeapon.textContent = playerInventory.equipped.weapon ? playerInventory.equipped.weapon.name : 'None';
    equippedArmor.textContent = playerInventory.equipped.armor ? playerInventory.equipped.armor.name : 'None';
    equippedShield.textContent = playerInventory.equipped.shield ? playerInventory.equipped.shield.name : 'None';
    equippedHelmet.textContent = playerInventory.equipped.helmet ? playerInventory.equipped.helmet.name : 'None';
    
    // Update inventory items with enhanced display
    inventoryItemsContainer.innerHTML = '';
    
    if (playerInventory.inventory.length === 0) {
        inventoryItemsContainer.innerHTML = '<div class="empty-inventory">No items</div>';
        return;
    }
    
    playerInventory.inventory.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.classList.add('inventory-item');
        
        // Add rarity class for styling
        if (item.rarity) {
            itemEl.classList.add(`rarity-${item.rarity}`);
        }
        
        let statsText = '';
        if (item.damage) {
            statsText = `+${item.damage} Damage`;
        } else if (item.defense) {
            statsText = `+${item.defense} Defense`;
        }
        
        itemEl.innerHTML = `
            <div class="item-icon">
                <img src="${item.image || 'images/default-item.png'}" alt="${item.name}" onerror="this.src='images/default-item.png'">
            </div>
            <div class="item-details">
                <div class="item-name ${item.rarity || 'common'}">${item.name}</div>
                <div class="item-stats">${statsText}</div>
                <div class="item-description">${item.description || ''}</div>
            </div>
            <button class="equip-btn" data-id="${item.id}" data-type="${item.type}">Equip</button>
        `;
        
        const equipBtn = itemEl.querySelector('.equip-btn');
        equipBtn.addEventListener('click', () => {
            console.log(`⚔️ Equipping item: ${item.name} (${item.type})`);
            equipItem(item.id, item.type);
        });
        
        inventoryItemsContainer.appendChild(itemEl);
    });
}

function updateEquipmentDisplay() {
    if (!playerInventory) {
        console.log('No player inventory data available');
        return;
    }
    
    console.log('🔄 Updating equipment display with inventory:', playerInventory);
    
    const equipmentSlots = ['weapon', 'armor', 'shield', 'helmet', 'boots', 'gloves', 'amulet', 'ring'];
    
    equipmentSlots.forEach(slotType => {
        const equippedItem = playerInventory.equipped[slotType];
        updateEquipmentSlotDisplay(slotType, equippedItem);
    });
    
    // Update combat stats since equipment affects them
    updateStatsUI();
    
    console.log('✅ Equipment display updated successfully');
}

// This function is no longer needed as the logic is now inside updateEquipmentSlotDisplay
// function updateEquipmentQualityClass(type, item) { ... }

function equipItem(itemId, itemType) {
    socket.emit('equipItem', { itemId, itemType });
}

function animateEquipItem(slotElement) {
    slotElement.classList.add('just-equipped');
    setTimeout(() => {
        slotElement.classList.remove('just-equipped');
    }, 1000);
}

function showLevelUpNotification(level, bonusPoints) {
    const notification = document.createElement('div');
    notification.classList.add('level-up-notification');
    notification.innerHTML = `
        <h3>Level Up!</h3>
        <p>You are now level ${level}!</p>
        <p>You received ${bonusPoints} bonus stat points!</p>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

function showModal(modal) {
    modal.classList.remove('hidden');
}

function hideModal(modal) {
    modal.classList.add('hidden');
}

// Debug functions
function debugEquipmentDisplay() {
    console.log('🔍 === EQUIPMENT DISPLAY DEBUG ===');
    console.log('Player Inventory:', playerInventory);
    console.log('Equipment Slots Count:', document.querySelectorAll('.equipment-slot').length);
    if (playerInventory && playerInventory.equipped) {
        Object.entries(playerInventory.equipped).forEach(([slot, item]) => {
            if (item) {
                console.log(`${slot.toUpperCase()}:`, {
                    name: item.name,
                    image: item.image,
                    rarity: item.rarity
                });
            }
        });
    }
}

function forceUpdateEquipmentDisplay() {
    console.log('🔧 Force updating equipment display...');
    if (playerInventory) {
        updateEquipmentDisplay();
    } else {
        console.warn('No player inventory available');
    }
}

window.debugEquipmentDisplay = debugEquipmentDisplay;
window.forceUpdateEquipmentDisplay = forceUpdateEquipmentDisplay;
window.updateEquipmentSlotDisplay = updateEquipmentSlotDisplay;

// Compatibility script
document.addEventListener('DOMContentLoaded', function() {
    function updateDisplayedValues() {
        const playerLevel = document.getElementById('player-level').textContent;
        const playerWins = document.getElementById('player-wins').textContent;
        const winsForLevel = document.getElementById('wins-for-level').textContent;
        const displayLevel = document.getElementById('display-level');
        const displayWins = document.getElementById('display-wins');
        const displayWinsNeeded = document.getElementById('display-wins-needed');
        if (displayLevel) displayLevel.textContent = playerLevel;
        if (displayWins) displayWins.textContent = playerWins;
        if (displayWinsNeeded) displayWinsNeeded.textContent = winsForLevel;
    }
    function updateHeaderName() {
        const characterName = document.getElementById('character-name').textContent;
        if (characterName && characterName !== 'Player Name') {
            document.getElementById('header-player-name').textContent = characterName;
        }
    }
    function updateCharacterClass() {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const userData = JSON.parse(userStr);
                if (userData.characterClass) {
                    const overview = document.getElementById('character-overview');
                    const classes = ['shadowsteel', 'ironbound', 'flameheart', 'venomfang'];
                    classes.forEach(cls => overview.classList.remove(cls));
                    overview.classList.add(userData.characterClass);
                    const classMap = {
                        'shadowsteel': 'Shadow Warrior',
                        'ironbound': 'Metal Berserker',
                        'flameheart': 'Fire Warrior',
                        'venomfang': 'Poison Assassin'
                    };
                    document.getElementById('character-class').textContent = 
                        userData.characterClass.charAt(0).toUpperCase() + userData.characterClass.slice(1);
                    document.getElementById('character-subclass').textContent = 
                        classMap[userData.characterClass] || 'Warrior';
                }
            }
        } catch (e) {
            console.error('Error updating character class:', e);
        }
    }
    const levelObserver = new MutationObserver(updateDisplayedValues);
    const nameObserver = new MutationObserver(updateHeaderName);
    const playerLevelEl = document.getElementById('player-level');
    if (playerLevelEl) {
        levelObserver.observe(playerLevelEl, { childList: true });
    }
    const characterNameEl = document.getElementById('character-name');
    if (characterNameEl) {
        nameObserver.observe(characterNameEl, { childList: true });
    }
    setTimeout(() => {
        updateDisplayedValues();
        updateHeaderName();
        updateCharacterClass();
    }, 500);
    setInterval(() => {
        updateDisplayedValues();
        updateHeaderName();
    }, 2000);
});