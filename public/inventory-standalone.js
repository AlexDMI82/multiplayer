// inventory-standalone.js - Simple inventory page functionality
class InventoryPage {
    constructor() {
        this.socket = null;
        this.selectedItem = null;
        this.selectedEquipmentSlot = null;
        this.currentFilter = 'all';
        this.inventoryData = null;
        this.playerStats = null;
        this.playerData = null;
        
        this.init();
    }

    init() {
        console.log('🎒 Initializing inventory page...');
        
        // Check authentication
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        if (!token || !userStr) {
            window.location.href = '/login.html';
            return;
        }
        
        try {
            this.playerData = JSON.parse(userStr);
            this.setupSocket(token);
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing inventory page:', error);
            window.location.href = '/login.html';
        }
    }

    setupSocket(token) {
        this.socket = io({
            auth: { token }
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.requestInventoryData();
        });
        
        this.socket.on('inventory', (inventoryData) => {
            console.log('📦 Received inventory data:', inventoryData);
            this.inventoryData = inventoryData;
            this.updateDisplay();
        });
        
        this.socket.on('profileData', (data) => {
            console.log('👤 Received profile data:', data);
            if (data.user) this.playerData = data.user;
            if (data.stats) this.playerStats = data.stats;
            if (data.inventory) this.inventoryData = data.inventory;
            this.updateDisplay();
        });
        
        this.socket.on('equipmentUpdated', (data) => {
            console.log('⚔️ Equipment updated:', data);
            if (this.inventoryData) {
                this.inventoryData.equipped = data.equipped;
                this.inventoryData.inventory = data.inventory;
                this.inventoryData.gold = data.gold || this.inventoryData.gold;
                this.updateDisplay();
                this.showEquipAnimation(data.slotType);
            }
        });
        
        this.socket.on('statsUpdate', (stats) => {
            console.log('📊 Stats updated:', stats);
            this.playerStats = stats;
            this.updateCharacterStats();
        });
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.updateInventoryGrid();
            });
        });

        // Equipment slots
        document.querySelectorAll('.equipment-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const slotType = slot.dataset.slot;
                
                // Check if clicking on the unequip area for equipped items
                if (slot.classList.contains('equipped')) {
                    this.unequipItem(slotType);
                    return;
                }
                
                // Try to equip selected item or highlight compatible
                if (this.selectedItem && this.canEquipItem(this.selectedItem, slotType)) {
                    this.equipItem(this.selectedItem.id, slotType);
                } else {
                    this.highlightCompatibleItems(slotType);
                }
            });
        });

        // Action buttons
        document.getElementById('equip-selected-item').addEventListener('click', () => {
            if (this.selectedItem) {
                this.equipItem(this.selectedItem.id, this.selectedItem.type);
            }
        });

        document.getElementById('unequip-selected-slot').addEventListener('click', () => {
            if (this.selectedEquipmentSlot) {
                this.unequipItem(this.selectedEquipmentSlot);
            }
        });

        document.getElementById('sort-inventory').addEventListener('click', () => {
            this.sortInventory();
        });
    }

    requestInventoryData() {
        this.socket.emit('getProfile');
        this.socket.emit('getInventory');
        this.socket.emit('requestStats');
    }

    updateDisplay() {
        this.updateCharacterDisplay();
        this.updateEquippedItems();
        this.updateInventoryGrid();
        this.updateCharacterStats();
        this.updateGold();
    }

    updateCharacterDisplay() {
        if (!this.playerData) return;

        const avatarElement = document.getElementById('character-avatar');
        const classElement = document.getElementById('character-class');
        const subclassElement = document.getElementById('character-subclass');

        // Set character avatar
        if (this.playerData.characterClass && this.playerData.characterClass !== 'unselected') {
            avatarElement.src = `/images/characters/${this.playerData.characterClass}.png`;
            avatarElement.onerror = () => {
                const avatarSrc = this.playerData.avatar?.startsWith('/') ? 
                    this.playerData.avatar : `/images/${this.playerData.avatar || 'default-avatar.png'}`;
                avatarElement.src = avatarSrc;
            };
            
            // Add character class styling
            const characterPanel = document.querySelector('.character-panel');
            characterPanel.className = 'character-panel character-overview ' + this.playerData.characterClass;
            
            // Set class info
            const classMap = {
                'shadowsteel': { name: 'Shadowsteel', subclass: 'Shadow Warrior' },
                'ironbound': { name: 'Ironbound', subclass: 'Metal Berserker' },
                'flameheart': { name: 'Flameheart', subclass: 'Fire Warrior' },
                'venomfang': { name: 'Venomfang', subclass: 'Poison Assassin' }
            };
            
            const classInfo = classMap[this.playerData.characterClass];
            if (classInfo) {
                classElement.textContent = classInfo.name;
                subclassElement.textContent = classInfo.subclass;
            }
        } else {
            const avatarSrc = this.playerData.avatar?.startsWith('/') ? 
                this.playerData.avatar : `/images/${this.playerData.avatar || 'default-avatar.png'}`;
            avatarElement.src = avatarSrc;
            
            classElement.textContent = 'No Class';
            subclassElement.textContent = 'Unassigned';
        }
    }

    updateEquippedItems() {
        if (!this.inventoryData || !this.inventoryData.equipped) return;

        const slots = ['helmet', 'weapon', 'armor', 'shield', 'boots', 'gloves', 'ring', 'amulet'];
        
        slots.forEach(slotType => {
            const slot = document.querySelector(`[data-slot="${slotType}"]`);
            const nameElement = document.getElementById(`${slotType}-name`);
            
            if (!slot || !nameElement) return;
            
            if (this.inventoryData.equipped[slotType]) {
                const item = this.inventoryData.equipped[slotType];
                
                // Update visual
                slot.classList.add('equipped');
                this.addRarityClass(slot, item.rarity);
                nameElement.textContent = item.name;
                
                // Update icon
                const slotIcon = slot.querySelector('.slot-icon');
                if (slotIcon) {
                    if (item.image) {
                        const imagePath = item.image.startsWith('/') ? item.image : `/${item.image}`;
                        slotIcon.src = imagePath;
                        slotIcon.onerror = () => {
                            slotIcon.src = this.getDefaultSlotIcon(slotType);
                        };
                    } else {
                        slotIcon.src = this.getDefaultSlotIcon(slotType);
                    }
                }
                
                slot.title = `${item.name} - Click to unequip`;
            } else {
                slot.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');
                nameElement.textContent = 'None';
                
                const slotIcon = slot.querySelector('.slot-icon');
                if (slotIcon) {
                    slotIcon.src = this.getDefaultSlotIcon(slotType);
                }
                
                slot.title = `${slotType.charAt(0).toUpperCase() + slotType.slice(1)} - Empty`;
            }
        });
    }

    updateInventoryGrid() {
        if (!this.inventoryData || !this.inventoryData.inventory) return;

        const grid = document.getElementById('inventory-items-grid');
        grid.innerHTML = '';

        // Filter items
        const filteredItems = this.inventoryData.inventory.filter(item => {
            if (this.currentFilter === 'all') return true;
            if (this.currentFilter === 'accessory') {
                return ['ring', 'amulet', 'boots', 'gloves'].includes(item.type);
            }
            return item.type === this.currentFilter;
        });

        // Create inventory slots
        const minSlots = 24;
        const totalSlots = Math.max(minSlots, Math.ceil(filteredItems.length / 6) * 6);
        
        for (let i = 0; i < totalSlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            
            if (i < filteredItems.length) {
                const item = filteredItems[i];
                this.addRarityClass(slot, item.rarity);
                
                const itemIcon = document.createElement('img');
                itemIcon.className = 'item-icon';
                itemIcon.alt = item.name;
                
                if (item.image) {
                    const imagePath = item.image.startsWith('/') ? item.image : `/${item.image}`;
                    itemIcon.src = imagePath;
                    itemIcon.onerror = () => {
                        itemIcon.src = this.getDefaultSlotIcon(item.type);
                    };
                } else {
                    itemIcon.src = this.getDefaultSlotIcon(item.type);
                }
                
                const itemName = document.createElement('div');
                itemName.className = 'item-name-small';
                itemName.textContent = item.name;
                
                slot.appendChild(itemIcon);
                slot.appendChild(itemName);
                
                slot.itemData = item;
                slot.addEventListener('click', () => this.selectItem(item, slot));
                slot.title = this.getItemTooltip(item);
            } else {
                slot.classList.add('empty');
                slot.style.opacity = '0.3';
                slot.style.borderStyle = 'dashed';
            }
            
            grid.appendChild(slot);
        }
    }

    updateCharacterStats() {
        if (!this.playerStats) return;

        document.getElementById('char-strength').textContent = this.playerStats.strength || 10;
        document.getElementById('char-agility').textContent = this.playerStats.agility || 10;
        document.getElementById('char-intuition').textContent = this.playerStats.intuition || 10;
        document.getElementById('char-endurance').textContent = this.playerStats.endurance || 10;
    }

    updateGold() {
        if (this.inventoryData) {
            document.getElementById('player-gold-amount').textContent = this.inventoryData.gold || 0;
        }
    }

    selectItem(item, slotElement) {
        // Remove previous selections
        document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('selected'));
        document.querySelectorAll('.equipment-slot').forEach(s => s.classList.remove('selected'));
        
        slotElement.classList.add('selected');
        this.selectedItem = item;
        this.selectedEquipmentSlot = null;
        
        // Update action buttons
        const equipBtn = document.getElementById('equip-selected-item');
        equipBtn.disabled = false;
        equipBtn.textContent = `Equip ${item.name}`;
        
        const unequipBtn = document.getElementById('unequip-selected-slot');
        unequipBtn.disabled = true;
        unequipBtn.textContent = 'Unequip Selected';
    }

    equipItem(itemId, itemType) {
        console.log('⚔️ Equipping item:', itemId, itemType);
        this.socket.emit('equipItem', { itemId, itemType });
        this.clearSelection();
    }

    unequipItem(slotType) {
        console.log('🔄 Unequipping item from slot:', slotType);
        this.socket.emit('unequipItem', { slotType });
        this.clearSelection();
    }

    clearSelection() {
        this.selectedItem = null;
        this.selectedEquipmentSlot = null;
        
        document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('selected'));
        document.querySelectorAll('.equipment-slot').forEach(s => s.classList.remove('selected'));
        
        const equipBtn = document.getElementById('equip-selected-item');
        equipBtn.disabled = true;
        equipBtn.textContent = 'Equip Selected';
        
        const unequipBtn = document.getElementById('unequip-selected-slot');
        unequipBtn.disabled = true;
        unequipBtn.textContent = 'Unequip Selected';
    }

    canEquipItem(item, slotType) {
        return item.type === slotType;
    }

    highlightCompatibleItems(slotType) {
        document.querySelectorAll('.inventory-slot').forEach(slot => {
            if (slot.itemData && this.canEquipItem(slot.itemData, slotType)) {
                slot.style.boxShadow = '0 0 15px rgba(100, 255, 100, 0.8)';
                setTimeout(() => {
                    slot.style.boxShadow = '';
                }, 2000);
            }
        });
    }

    sortInventory() {
        if (!this.inventoryData || !this.inventoryData.inventory) return;
        
        const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
        
        this.inventoryData.inventory.sort((a, b) => {
            const rarityDiff = (rarityOrder[b.rarity] || 1) - (rarityOrder[a.rarity] || 1);
            if (rarityDiff !== 0) return rarityDiff;
            return a.name.localeCompare(b.name);
        });
        
        this.updateInventoryGrid();
        console.log('📋 Inventory sorted by rarity and name');
    }

    showEquipAnimation(slotType) {
        if (slotType) {
            const slotElement = document.querySelector(`[data-slot="${slotType}"]`);
            if (slotElement) {
                slotElement.classList.add('just-equipped');
                setTimeout(() => {
                    slotElement.classList.remove('just-equipped');
                }, 1000);
            }
        }
    }

    addRarityClass(element, rarity) {
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        rarities.forEach(r => element.classList.remove(r));
        if (rarity) {
            element.classList.add(rarity);
        }
    }

    getDefaultSlotIcon(itemType) {
        const iconMap = {
            weapon: '/images/slot-sword.svg',
            armor: '/images/slot-armor.svg',
            helmet: '/images/slot-helmet.svg',
            shield: '/images/slot-shield.svg',
            ring: '/images/slot-ring.svg',
            amulet: '/images/slot-amulet.svg',
            boots: '/images/slot-boots.svg',
            gloves: '/images/slot-gloves.svg'
        };
        
        return iconMap[itemType] || '/images/slot-default.svg';
    }

    getItemTooltip(item) {
        let tooltip = `${item.name}\n`;
        if (item.damage) tooltip += `+${item.damage} Damage\n`;
        if (item.defense) tooltip += `+${item.defense} Defense\n`;
        if (item.description) tooltip += `${item.description}`;
        return tooltip.trim();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new InventoryPage();
});