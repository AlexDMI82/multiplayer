// shop.js - Enhanced shop functionality

// Connect to Socket.io server
const socket = io({
    autoConnect: false
});

// DOM elements
const playerGoldSpan = document.getElementById('player-gold');
const playerGoldShopSpan = document.getElementById('player-gold-shop');
const shopItemsContainer = document.getElementById('shop-items-container');
const inventoryItemsContainer = document.getElementById('inventory-items-container');
const backToLobbyBtn = document.getElementById('back-to-lobby-from-shop');
const inventoryModal = document.getElementById('inventory-modal');
const closeInventoryBtn = document.getElementById('close-inventory');

// Equipment display elements
const equippedWeapon = document.getElementById('equipped-weapon');
const equippedArmor = document.getElementById('equipped-armor');
const equippedShield = document.getElementById('equipped-shield');
const equippedHelmet = document.getElementById('equipped-helmet');

// Shop display elements
const shopCharacterModel = document.getElementById('shop-character-model');
const shopCharacterName = document.getElementById('shop-character-name');
const shopCharacterClass = document.getElementById('shop-character-class');
const shopWeaponName = document.getElementById('shop-weapon-name');
const shopArmorName = document.getElementById('shop-armor-name');
const shopShieldName = document.getElementById('shop-shield-name');
const shopHelmetName = document.getElementById('shop-helmet-name');
const shopBootsName = document.getElementById('shop-boots-name');
const shopGlovesName = document.getElementById('shop-gloves-name');
const shopAmuletName = document.getElementById('shop-amulet-name');
const shopRingName = document.getElementById('shop-ring-name');

// Item details elements
const itemPreview = document.getElementById('item-preview');
const itemInfo = document.getElementById('item-info');
const itemTitle = document.getElementById('item-title');
const itemRarity = document.getElementById('item-rarity');
const itemAttributes = document.getElementById('item-attributes');
const itemDescription = document.getElementById('item-description');
const itemPriceButton = document.getElementById('item-price-button');
const buySelectedItemBtn = document.getElementById('buy-selected-item');
const insufficientFunds = document.getElementById('insufficient-funds');

// Character stats elements
const shopAttackPower = document.getElementById('shop-attack-power');
const shopDefense = document.getElementById('shop-defense');
const shopHealth = document.getElementById('shop-health');
const shopCritChance = document.getElementById('shop-crit-chance');

// Global state
let shopData = null;
let currentUser = null;
let selectedItem = null;
let playerInventory = null;
let playerStats = null;
let socketConnected = false;

// Complete mock shop data - matches server data structure
const mockShopData = {
    weapons: [
        {
            id: 'sword_001',
            name: 'Dark Sword',
            type: 'weapon',
            price: 100,
            damage: 5,
            rarity: 'common',
            image: '/images/swords/DarkSword.jpg',
            description: 'A basic iron sword, reliable and sturdy.'
        },
        {
            id: 'sword_002',
            name: 'Flaming Sword',
            type: 'weapon',
            price: 500,
            damage: 12,
            rarity: 'rare',
            image: '/images/swords/FlamingSword.jpg',
            description: 'A sword imbued with the essence of fire, burns enemies on hit.'
        },
        {
            id: 'sword_003',
            name: 'Poison Sword',
            type: 'weapon',
            price: 800,
            damage: 15,
            rarity: 'epic',
            image: '/images/swords/PoisonSword.jpg',
            description: 'A venomous blade that poisons enemies with each strike.'
        },
        {
            id: 'sword_004',
            name: 'Soul Sword',
            type: 'weapon',
            price: 1200,
            damage: 18,
            rarity: 'epic',
            image: '/images/swords/SoulSword.jpg',
            description: 'Forged in darkness, this blade drains the life force of enemies.'
        },
        {
            id: 'sword_005',
            name: 'Spectral Sword',
            type: 'weapon',
            price: 1500,
            damage: 20,
            rarity: 'legendary',
            image: '/images/swords/SpectralSword.jpg',
            description: 'A ghostly blade that phases through armor.'
        },
        {
            id: 'sword_006',
            name: 'Vampire Sword',
            type: 'weapon',
            price: 2000,
            damage: 22,
            rarity: 'legendary',
            image: '/images/swords/VampireSword.jpg',
            description: 'This cursed blade heals the wielder with each successful hit.'
        }
    ],
    armor: [
        {
            id: 'armor_001',
            name: 'Leather Vest',
            type: 'armor',
            price: 150,
            defense: 5,
            rarity: 'common',
            image: '/images/armor/leather.png',
            description: 'Basic leather protection for adventurers.'
        },
        {
            id: 'armor_002',
            name: 'Iron Chestplate',
            type: 'armor',
            price: 400,
            defense: 10,
            rarity: 'uncommon',
            image: '/images/armor/iron.png',
            description: 'Solid iron protection for the torso.'
        },
        {
            id: 'armor_003',
            name: 'Steel Plate Armor',
            type: 'armor',
            price: 800,
            defense: 15,
            rarity: 'rare',
            image: '/images/armor/steel.png',
            description: 'Heavy steel armor providing excellent protection.'
        },
        {
            id: 'armor_004',
            name: 'Dragon Scale Armor',
            type: 'armor',
            price: 1500,
            defense: 20,
            rarity: 'legendary',
            image: '/images/armor/dragon.png',
            description: 'Legendary armor crafted from ancient dragon scales.'
        }
    ],
    shields: [
        {
            id: 'shield_001',
            name: 'Dark Shield',
            type: 'shield',
            price: 100,
            defense: 3,
            rarity: 'common',
            image: '/images/shields/darkShield.jpg',
            description: 'A basic dark shield providing minimal protection.'
        },
        {
            id: 'shield_002',
            name: 'Flame Shield',
            type: 'shield',
            price: 300,
            defense: 7,
            rarity: 'uncommon',
            image: '/images/shields/flameShield.jpg',
            description: 'A shield imbued with fire magic, burns attackers on contact.'
        },
        {
            id: 'shield_003',
            name: 'Long Shield',
            type: 'shield',
            price: 600,
            defense: 12,
            rarity: 'rare',
            image: '/images/shields/longShield.jpg',
            description: 'An elongated shield providing excellent coverage and protection.'
        },
        {
            id: 'shield_004',
            name: 'Poison Shield',
            type: 'shield',
            price: 800,
            defense: 15,
            rarity: 'epic',
            image: '/images/shields/poisonShield.jpg',
            description: 'A toxic shield that poisons enemies who strike it.'
        },
        {
            id: 'shield_005',
            name: 'Spectral Shield',
            type: 'shield',
            price: 1200,
            defense: 18,
            rarity: 'legendary',
            image: '/images/shields/spectralShield.jpg',
            description: 'A ghostly shield that can phase through certain attacks.'
        },
        {
            id: 'shield_006',
            name: 'Undead Shield',
            type: 'shield',
            price: 1500,
            defense: 20,
            rarity: 'legendary',
            image: '/images/shields/undeadShield.jpg',
            description: 'A cursed shield crafted from undead essence, radiates dark energy.'
        }
    ],
    helmets: [
        {
            id: 'helmet_001',
            name: 'Dark Helm',
            type: 'helmet',
            price: 100,
            defense: 2,
            rarity: 'common',
            image: '/images/helm/darHelm.jpg',
            description: 'A basic dark helmet providing minimal head protection.'
        },
        {
            id: 'helmet_002',
            name: 'Fire Helm',
            type: 'helmet',
            price: 300,
            defense: 5,
            rarity: 'uncommon',
            image: '/images/helm/fireHelm.jpg',
            description: 'A helmet forged with fire magic, radiates warmth and protection.'
        },
        {
            id: 'helmet_003',
            name: 'Poison Helm',
            type: 'helmet',
            price: 600,
            defense: 8,
            rarity: 'rare',
            image: '/images/helm/poisonHelm.jpg',
            description: 'A toxic helmet that creates a poisonous aura around the wearer.'
        },
        {
            id: 'helmet_004',
            name: 'Soul Helm',
            type: 'helmet',
            price: 900,
            defense: 12,
            rarity: 'epic',
            image: '/images/helm/soulsHelm.jpg',
            description: 'A cursed helmet that channels the power of trapped souls.'
        },
        {
            id: 'helmet_005',
            name: 'Spectral Helm',
            type: 'helmet',
            price: 1200,
            defense: 15,
            rarity: 'legendary',
            image: '/images/helm/spectralHelm.jpg',
            description: 'A ghostly helmet that provides ethereal protection and enhanced vision.'
        },
        {
            id: 'helmet_006',
            name: 'Vampire Helm',
            type: 'helmet',
            price: 1500,
            defense: 18,
            rarity: 'legendary',
            image: '/images/helm/vampireHelm.jpg',
            description: 'A vampiric helmet that drains enemy life force and transfers it to the wearer.'
        }
    ],
    accessories: [
        {
            id: 'boots_001',
            name: 'Leather Boots',
            type: 'boots',
            price: 80,
            defense: 1,
            rarity: 'common',
            image: '/images/accessories/boots.png',
            description: 'Comfortable leather boots for long journeys.'
        },
        {
            id: 'boots_002',
            name: 'Steel Boots',
            type: 'boots',
            price: 200,
            defense: 3,
            rarity: 'uncommon',
            image: '/images/accessories/steel_boots.png',
            description: 'Heavy steel boots with reinforced toes.'
        },
        {
            id: 'gloves_001',
            name: 'Leather Gloves',
            type: 'gloves',
            price: 60,
            defense: 1,
            rarity: 'common',
            image: '/images/accessories/gloves.png',
            description: 'Basic leather gloves for protection.'
        },
        {
            id: 'gloves_002',
            name: 'Steel Gauntlets',
            type: 'gloves',
            price: 180,
            defense: 3,
            rarity: 'uncommon',
            image: '/images/accessories/gauntlets.png',
            description: 'Reinforced steel gauntlets for protection.'
        },
        {
            id: 'amulet_001',
            name: 'Health Amulet',
            type: 'amulet',
            price: 300,
            defense: 0,
            rarity: 'rare',
            image: '/images/accessories/amulet.png',
            description: 'Mystical amulet that boosts vitality.'
        },
        {
            id: 'ring_001',
            name: 'Power Ring',
            type: 'ring',
            price: 250,
            defense: 0,
            rarity: 'rare',
            image: '/images/accessories/ring.png',
            description: 'Ring imbued with magical power.'
        }
    ]
};

// Character class data
const characterClasses = {
    shadowsteel: { name: 'Shadowsteel', subclass: 'Shadow Warrior' },
    ironbound: { name: 'Ironbound', subclass: 'Metal Berserker' },
    flameheart: { name: 'Flameheart', subclass: 'Fire Warrior' },
    venomfang: { name: 'Venomfang', subclass: 'Poison Assassin' }
};

// Initialize
function init() {
    console.log('🏪 Initializing shop...');
    
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        console.log('❌ No token or user found, redirecting to login');
        window.location.href = '/login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(userStr);
        console.log('✅ Current user loaded:', currentUser.username);
        
        // Initialize shop data immediately
        shopData = mockShopData;
        console.log('✅ Mock shop data loaded');
        
        // Set up UI
        setupEventListeners();
        updateCharacterDisplay();
        updateGoldDisplay();
        
        // Display weapons by default
        displayShopItems('weapons');
        
        // Try to connect to socket for real data
        connectToServer(token);
        
    } catch (error) {
        console.error('❌ Error initializing shop:', error);
        window.location.href = '/login.html';
    }
}

// Connect to server
function connectToServer(token) {
    if (typeof io === 'undefined') {
        console.log('⚠️ Socket.io not available, using mock data only');
        return;
    }
    
    socket.auth = { token };
    socket.connect();
    
    socket.on('connect', () => {
        console.log('🔗 Socket connected to server');
        socketConnected = true;
        socket.emit('authenticate', token);
    });
    
    socket.on('authenticated', () => {
        console.log('✅ Socket authenticated');
        socket.emit('getShopItems');
        socket.emit('getInventory');
        socket.emit('getProfile');
    });
    
    socket.on('connect_error', (error) => {
        console.log('⚠️ Socket connection failed, using mock data:', error.message);
        socketConnected = false;
    });
}

// Update character display
function updateCharacterDisplay() {
    if (!currentUser) return;
    
    console.log('🎨 Updating character display for:', currentUser.username);
    
    // Set character model
    if (currentUser.characterClass && currentUser.characterClass !== 'unselected') {
        if (shopCharacterModel) {
            shopCharacterModel.src = `/images/characters/${currentUser.characterClass}.png`;
            shopCharacterModel.onerror = function() {
                console.log('⚠️ Character image failed to load, using avatar');
                this.src = currentUser.avatar?.startsWith('images/') ? 
                    `/${currentUser.avatar}` : `/images/${currentUser.avatar || 'default-avatar.png'}`;
            };
        }
        if (shopCharacterClass) {
            const classData = characterClasses[currentUser.characterClass];
            shopCharacterClass.textContent = classData ? classData.subclass : currentUser.characterClass;
        }
    } else {
        // Use avatar if no character class
        if (shopCharacterModel && currentUser.avatar) {
            const avatarPath = currentUser.avatar;
            if (avatarPath.startsWith('/')) {
                shopCharacterModel.src = avatarPath;
            } else if (avatarPath.startsWith('images/')) {
                shopCharacterModel.src = '/' + avatarPath;
            } else {
                shopCharacterModel.src = `/images/${avatarPath}`;
            }
        }
        if (shopCharacterClass) {
            shopCharacterClass.textContent = 'No Class Selected';
        }
    }
    
    if (shopCharacterName) {
        shopCharacterName.textContent = currentUser.username || 'Player';
    }
}

// Update gold display
function updateGoldDisplay() {
    const gold = currentUser?.gold || 1000; // Default gold for demo
    if (playerGoldShopSpan) playerGoldShopSpan.textContent = gold;
    if (playerGoldSpan) playerGoldSpan.textContent = gold;
}

// Update equipment display
function updateEquipmentDisplay(equipped) {
    console.log('🛡️ Updating equipment display:', equipped);
    
    // Update modal elements (for compatibility)
    if (equippedWeapon) equippedWeapon.textContent = equipped.weapon ? equipped.weapon.name : 'None';
    if (equippedArmor) equippedArmor.textContent = equipped.armor ? equipped.armor.name : 'None';
    if (equippedShield) equippedShield.textContent = equipped.shield ? equipped.shield.name : 'None';
    if (equippedHelmet) equippedHelmet.textContent = equipped.helmet ? equipped.helmet.name : 'None';
    
    // Update shop display
    updateEquipmentSlot('weapon', equipped.weapon);
    updateEquipmentSlot('armor', equipped.armor);
    updateEquipmentSlot('shield', equipped.shield);
    updateEquipmentSlot('helmet', equipped.helmet);
    updateEquipmentSlot('boots', equipped.boots);
    updateEquipmentSlot('gloves', equipped.gloves);
    updateEquipmentSlot('amulet', equipped.amulet);
    updateEquipmentSlot('ring', equipped.ring);
}

// Update individual equipment slot
function updateEquipmentSlot(slotType, item) {
    const slotElement = document.querySelector(`.slot-${slotType}`);
    const nameElement = document.getElementById(`shop-${slotType}-name`);
    
    if (slotElement && nameElement) {
        if (item) {
            slotElement.classList.add('has-item');
            nameElement.textContent = item.name;
        } else {
            slotElement.classList.remove('has-item');
            nameElement.textContent = 'None';
        }
    }
}

// Update character stats
function updateCharacterStats() {
    if (!playerStats) {
        // Use default stats
        playerStats = {
            strength: 10,
            endurance: 10,
            intuition: 10
        };
    }
    
    // Calculate total attack power
    let attackPower = (playerStats.strength || 10) * 2;
    if (playerInventory?.equipped?.weapon) {
        attackPower += playerInventory.equipped.weapon.damage || 0;
    }
    
    // Calculate total defense
    let defense = 0;
    const equipment = playerInventory?.equipped || {};
    ['armor', 'shield', 'helmet', 'boots', 'gloves'].forEach(slot => {
        if (equipment[slot]?.defense) {
            defense += equipment[slot].defense;
        }
    });
    
    // Update display
    if (shopAttackPower) shopAttackPower.textContent = attackPower;
    if (shopDefense) shopDefense.textContent = defense;
    if (shopHealth) shopHealth.textContent = 100 + ((playerStats.endurance || 10) * 10);
    if (shopCritChance) shopCritChance.textContent = `${playerStats.intuition || 10}%`;
}

// Set up event listeners
function setupEventListeners() {
    console.log('🎮 Setting up event listeners...');
    
    // Category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const category = btn.getAttribute('data-category');
            console.log('📂 Category selected:', category);
            displayShopItems(category);
        });
    });
    
    // Back to lobby
    if (backToLobbyBtn) {
        backToLobbyBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }
    
    // Buy button
    if (buySelectedItemBtn) {
        buySelectedItemBtn.addEventListener('click', () => {
            if (selectedItem) {
                buyItem(selectedItem.id, selectedItem.type);
            }
        });
    }
    
    // Inventory modal close
    if (closeInventoryBtn) {
        closeInventoryBtn.addEventListener('click', () => {
            hideModal(inventoryModal);
        });
    }
}

// Display shop items
function displayShopItems(category) {
    console.log(`🛍️ Displaying items for category: ${category}`);
    console.log('📦 Available shop data:', Object.keys(shopData || {}));
    
    if (!shopData) {
        console.error('❌ No shop data available');
        showEmptyShop('Shop data not loaded');
        return;
    }
    
    if (!shopItemsContainer) {
        console.error('❌ Shop items container not found');
        return;
    }
    
    shopItemsContainer.innerHTML = '';
    
    const items = shopData[category] || [];
    console.log(`📋 Items to display for ${category}:`, items.length, 'items');
    
    if (items.length === 0) {
        showEmptyShop(`No items available in ${category} category`);
        return;
    }
    
    items.forEach((item, index) => {
        console.log(`🏷️ Creating item ${index + 1}:`, item.name);
        const itemEl = createShopItemElement(item);
        shopItemsContainer.appendChild(itemEl);
    });
    
    console.log(`✅ Successfully added ${items.length} items to shop display`);
}

// Create shop item element
function createShopItemElement(item) {
    const itemEl = document.createElement('div');
    itemEl.classList.add('shop-item', item.rarity || 'common');
    
    itemEl.innerHTML = `
        <div class="item-thumbnail">
            ${item.image ? 
                `<img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                ''
            }
            <div class="item-placeholder" style="${item.image ? 'display:none;' : ''}">${item.name.charAt(0)}</div>
        </div>
        <div class="item-name">${item.name}</div>
        <div class="item-stats">${getItemStats(item)}</div>
        <div class="item-price">${item.price} Gold</div>
    `;
    
    itemEl.addEventListener('click', () => {
        selectItem(item, itemEl);
    });
    
    return itemEl;
}

// Show empty shop message
function showEmptyShop(message) {
    if (shopItemsContainer) {
        shopItemsContainer.innerHTML = `<div class="empty-shop">${message}</div>`;
    }
}

// Get item stats display
function getItemStats(item) {
    if (item.damage) return `+${item.damage} Damage`;
    if (item.defense) return `+${item.defense} Defense`;
    return 'Special Item';
}

// Select an item
function selectItem(item, element) {
    console.log('🎯 Selected item:', item.name);
    selectedItem = item;
    
    // Update selection state
    document.querySelectorAll('.shop-item').forEach(el => el.classList.remove('selected'));
    if (element) {
        element.classList.add('selected');
    }
    
   if (itemPreview) {
        if (item.image) {
            // FIXED: Clean image display without extra text
            itemPreview.innerHTML = `<img src="${item.image}" alt="" title="">`;
        } else {
            itemPreview.innerHTML = `<div class="no-item-image">${item.name}</div>`;
        }
    }

    
    // Update item info
    if (itemTitle) itemTitle.textContent = item.name;
    if (itemRarity) {
        itemRarity.textContent = item.rarity || 'common';
        itemRarity.className = `item-rarity ${item.rarity || 'common'}`;
    }
    
    // Update attributes
    if (itemAttributes) {
        itemAttributes.innerHTML = `
            ${item.damage ? `<div class="attribute-row">
                <span>Damage</span>
                <span class="attribute-value">+${item.damage}</span>
            </div>` : ''}
            ${item.defense ? `<div class="attribute-row">
                <span>Defense</span>
                <span class="attribute-value">+${item.defense}</span>
            </div>` : ''}
            <div class="attribute-row">
                <span>Type</span>
                <span class="attribute-value">${item.type}</span>
            </div>
            <div class="attribute-row">
                <span>Rarity</span>
                <span class="attribute-value">${item.rarity || 'common'}</span>
            </div>
        `;
    }
    
    if (itemDescription) {
        itemDescription.textContent = item.description || 'No description available.';
    }
    
    if (itemPriceButton) {
        itemPriceButton.textContent = item.price;
    }
    
    // Check if player can afford
    const playerGold = parseInt(playerGoldShopSpan?.textContent) || 1000;
    if (playerGold < item.price) {
        if (buySelectedItemBtn) buySelectedItemBtn.disabled = true;
        if (insufficientFunds) insufficientFunds.style.display = 'block';
    } else {
        if (buySelectedItemBtn) buySelectedItemBtn.disabled = false;
        if (insufficientFunds) insufficientFunds.style.display = 'none';
    }
    
    // Show item info
    if (itemInfo) itemInfo.style.display = 'block';
}

// Buy item
function buyItem(itemId, itemType) {
    console.log('💰 Attempting to buy item:', itemId, itemType);
    
    if (socketConnected && socket.connected) {
        socket.emit('buyItem', { itemId, itemType });
    } else {
        // Mock purchase for demo
        console.log('🔄 Using mock purchase (server not connected)');
        const playerGold = parseInt(playerGoldShopSpan?.textContent) || 1000;
        if (selectedItem && playerGold >= selectedItem.price) {
            const newGold = playerGold - selectedItem.price;
            
            // Update gold display
            if (playerGoldShopSpan) playerGoldShopSpan.textContent = newGold;
            if (playerGoldSpan) playerGoldSpan.textContent = newGold;
            
            // Update user data
            currentUser.gold = newGold;
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            alert(`✅ You purchased ${selectedItem.name} for ${selectedItem.price} gold!`);
            
            // Re-check if we can still afford selected item
            if (selectedItem) {
                selectItem(selectedItem);
            }
        } else {
            alert('❌ Insufficient funds!');
        }
    }
}

// Update inventory display
function updateInventoryDisplay(inventoryData) {
    console.log('📦 Updating inventory display:', inventoryData);
    playerInventory = inventoryData;
    
    if (playerGoldSpan) playerGoldSpan.textContent = inventoryData.gold;
    if (playerGoldShopSpan) playerGoldShopSpan.textContent = inventoryData.gold;
    
    if (inventoryData.equipped) {
        updateEquipmentDisplay(inventoryData.equipped);
    }
    
    updateCharacterStats();
    
    // Update inventory modal if needed
    if (!inventoryItemsContainer) return;
    
    inventoryItemsContainer.innerHTML = '';
    if (inventoryData.inventory.length === 0) {
        inventoryItemsContainer.innerHTML = '<div class="empty-inventory">No items</div>';
        return;
    }
    
    inventoryData.inventory.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.classList.add('inventory-item');
        itemEl.innerHTML = `
            <div class="item-name">${item.name}</div>
            <div class="item-stats">${getItemStats(item)}</div>
            <button class="equip-btn" data-id="${item.id}" data-type="${item.type}">Equip</button>
        `;
        const equipBtn = itemEl.querySelector('.equip-btn');
        equipBtn.addEventListener('click', () => {
            equipItem(item.id, item.type);
        });
        inventoryItemsContainer.appendChild(itemEl);
    });
}

// Equip item
function equipItem(itemId, itemType) {
    console.log('⚔️ Attempting to equip item:', itemId, itemType);
    
    if (socketConnected && socket.connected) {
        socket.emit('equipItem', { itemId, itemType });
    } else {
        console.log('⚠️ Socket not available for equipping items');
    }
}

// Socket event handlers (only if socket is available)
if (typeof io !== 'undefined') {
    socket.on('shopItems', (items) => {
        console.log('📥 Received shop items from server:', items);
        shopData = items;
        displayShopItems('weapons');
    });

    socket.on('inventory', (inventoryData) => {
        updateInventoryDisplay(inventoryData);
    });

    socket.on('profileData', (data) => {
        console.log('👤 Received profile data:', data);
        if (data.stats) {
            playerStats = data.stats;
            updateCharacterStats();
        }
        if (data.user) {
            currentUser = { ...currentUser, ...data.user };
            updateCharacterDisplay();
        }
    });

    socket.on('purchaseComplete', (data) => {
        console.log('✅ Purchase complete:', data);
        alert(`You purchased ${data.item.name}!`);
        if (playerGoldSpan) playerGoldSpan.textContent = data.newGold;
        if (playerGoldShopSpan) playerGoldShopSpan.textContent = data.newGold;
        socket.emit('getInventory');
        
        // Re-check if we can still afford selected item
        if (selectedItem) {
            selectItem(selectedItem);
        }
    });

    socket.on('purchaseFailed', (data) => {
        console.log('❌ Purchase failed:', data);
        alert(`Purchase failed: ${data.reason}`);
    });

    socket.on('equipmentUpdated', (data) => {
        console.log('🛡️ Equipment updated:', data);
        updateInventoryDisplay({
            gold: parseInt(playerGoldSpan ? playerGoldSpan.textContent : 0),
            equipped: data.equipped,
            inventory: data.inventory
        });
    });
}

// Helper functions
function showModal(modal) {
    if (modal) modal.classList.remove('hidden');
}

function hideModal(modal) {
    if (modal) modal.classList.add('hidden');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing shop...');
    init();
});