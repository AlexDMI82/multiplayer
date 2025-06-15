class ModernInventorySystem {
    constructor(socket) {
        this.socket = socket;
        this.selectedItem = null;
        this.currentFilter = 'all';
        this.inventoryData = null;
        this.playerStats = null;
        this.playerData = null;
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('🎒 Initializing Fullscreen Modern Inventory System...');
        
        // Add styles first
        this.addStyles();
        
        // Create modal
        this.createModal();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup socket events
        this.setupSocketEvents();
        
        // Replace old inventory functionality
        this.replaceOldInventory();
        
        this.isInitialized = true;
        console.log('✅ Fullscreen Modern Inventory System ready!');
    }

    addStyles() {
        // Only add styles if not already added
        if (document.getElementById('modern-inventory-styles')) {
            document.getElementById('modern-inventory-styles').remove();
        }
        
        const style = document.createElement('style');
        style.id = 'modern-inventory-styles';
        style.textContent = `
            /* Fullscreen Modern Inventory Styles */
            .modern-inventory-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.98);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                backdrop-filter: blur(5px);
            }

            .modern-inventory-container {
                background-color: rgba(15, 15, 15, 0.95);
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                width: 98vw;
                height: 95vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;
                animation: modalSlideIn 0.3s ease-out;
                border: 2px solid #4a5568;
            }

            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(-30px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            .modern-inventory-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #444;
                flex-shrink: 0;
            }

            .modern-inventory-title {
                color: #e0e0ff;
                font-size: 2.5rem;
                margin: 0;
                text-shadow: 0 0 10px rgba(100, 100, 255, 0.7);
            }

            .modern-player-gold-display {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #ffd700;
                font-size: 20px;
                font-weight: bold;
                text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
            }

            .modern-gold-icon {
                width: 28px;
                height: 28px;
                background: radial-gradient(circle, #ffd700, #b8860b);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
                animation: goldGlow 2s ease-in-out infinite alternate;
            }

            @keyframes goldGlow {
                from { box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4), 0 0 10px rgba(255, 215, 0, 0.3); }
                to { box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 215, 0, 0.6); }
            }

            .modern-close-inventory {
                background-color: #e53e3e;
                border: none;
                color: white;
                padding: 12px 18px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                font-size: 16px;
                transition: all 0.3s;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }

            .modern-close-inventory:hover {
                background-color: #c53030;
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            }

            .modern-inventory-body {
                display: grid;
                grid-template-columns: 450px 1fr;
                gap: 30px;
                flex: 1;
                overflow: hidden;
                min-height: 0;
            }

            /* Character Overview Panel - Left Side */
            .modern-character-overview {
                display: flex;
                flex-direction: column;
                background-color: #222;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                overflow-y: auto;
            }

            .modern-character-frame {
                position: relative;
                width: 100%;
                margin-bottom: 20px;
                flex-shrink: 0;
            }

            .modern-avatar-container {
                position: relative;
                width: 100%;
                height: 450px;
                background-color: #000;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 0 15px rgba(255, 0, 0, 0.5), 0 0 30px rgba(0, 0, 255, 0.3);
                border: 3px solid rgba(80, 80, 120, 0.7);
            }

            #modern-character-avatar {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }

            .modern-character-class-badge {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                background-color: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px;
                text-align: center;
                font-weight: bold;
                text-transform: capitalize;
                font-size: 1.1rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }

            .modern-character-subclass {
                font-size: 0.85em;
                color: #a0a0cc;
                margin-top: 3px;
            }

            /* Equipment slots overlay */
            .modern-equipment-slot {
                position: absolute;
                background-color: rgba(40, 40, 40, 0.9);
                border: 2px solid rgba(100, 100, 120, 0.8);
                border-radius: 8px;
                width: 65px;
                height: 65px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                cursor: pointer;
                overflow: hidden;
            }

            .modern-equipment-slot:hover {
                background-color: rgba(60, 60, 80, 0.9);
                transform: scale(1.05);
                box-shadow: 0 0 15px rgba(100, 150, 255, 0.7);
                z-index: 10;
            }

            /* Positioned slots */
            .helmet-slot { top: 15px; left: 15px; }
            .weapon-slot { top: 15px; right: 15px; }
            .armor-slot { top: 85px; left: 15px; }
            .amulet-slot { top: 85px; right: 15px; }
            .shield-slot { top: 155px; left: 15px; }
            .ring-slot { top: 155px; right: 15px; }
            .boots-slot { top: 225px; left: 15px; }
            .gloves-slot { top: 225px; right: 15px; }

            .modern-slot-icon {
                width: 40px;
                height: 40px;
                opacity: 0.8;
                border-radius: 4px;
                object-fit: contain;
                transition: all 0.3s ease;
            }

            .modern-equipment-name {
                position: absolute;
                bottom: 2px;
                left: 2px;
                right: 2px;
                font-size: 9px;
                color: #ddd;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                background-color: rgba(0, 0, 0, 0.7);
                border-radius: 2px;
                padding: 1px;
                line-height: 1.1;
            }

            /* Equipped item styling */
            .modern-equipment-slot.equipped {
                border-color: rgba(100, 255, 100, 0.9);
                background-color: rgba(50, 70, 50, 0.95);
                box-shadow: 0 0 15px rgba(100, 255, 100, 0.6);
                animation: equipPulse 3s ease-in-out infinite;
            }

            @keyframes equipPulse {
                0%, 100% { 
                    box-shadow: 0 0 15px rgba(100, 255, 100, 0.6);
                }
                50% { 
                    box-shadow: 0 0 25px rgba(100, 255, 100, 0.8);
                }
            }

            .modern-equipment-slot.equipped .modern-slot-icon {
                width: 50px;
                height: 50px;
                opacity: 1;
            }

            .modern-equipment-slot.equipped .modern-equipment-name {
                color: #90EE90;
                font-weight: bold;
                background-color: rgba(0, 80, 0, 0.8);
            }

            /* Item rarity colors */
            .modern-equipment-slot.common { border-color: #9d9d9d; }
            .modern-equipment-slot.uncommon { border-color: #1eff00; }
            .modern-equipment-slot.rare { border-color: #0070dd; }
            .modern-equipment-slot.epic { border-color: #a335ee; }
            .modern-equipment-slot.legendary { 
                border-color: #ff8000;
                animation: legendary-glow 2s ease-in-out infinite alternate;
            }

            @keyframes legendary-glow {
                0% { box-shadow: 0 0 10px rgba(255, 128, 0, 0.6); }
                100% { box-shadow: 0 0 25px rgba(255, 128, 0, 1); }
            }

            /* Character-specific styling */
            .modern-character-overview.shadowsteel .modern-avatar-container {
                box-shadow: 0 0 15px rgba(0, 0, 100, 0.8), 0 0 30px rgba(0, 0, 255, 0.5);
                border-color: #4a69bd;
            }
            
            .modern-character-overview.ironbound .modern-avatar-container {
                box-shadow: 0 0 15px rgba(100, 100, 100, 0.8), 0 0 30px rgba(150, 150, 150, 0.5);
                border-color: #7a7a7a;
            }
            
            .modern-character-overview.flameheart .modern-avatar-container {
                box-shadow: 0 0 15px rgba(200, 50, 0, 0.8), 0 0 30px rgba(255, 80, 0, 0.5);
                border-color: #bd4a4a;
            }
            
            .modern-character-overview.venomfang .modern-avatar-container {
                box-shadow: 0 0 15px rgba(0, 100, 0, 0.8), 0 0 30px rgba(0, 150, 0, 0.5);
                border-color: #4abd4a;
            }

            /* Character Stats Section */
            .modern-character-stats {
                background-color: rgba(30, 30, 30, 0.8);
                border-radius: 8px;
                padding: 20px;
                margin-top: 20px;
                border: 1px solid #444;
                flex-shrink: 0;
            }

            .modern-stats-title {
                color: #fff;
                margin: 0 0 20px 0;
                font-size: 18px;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
                text-align: center;
            }

            .modern-stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding: 8px 12px;
                border-bottom: 1px solid #333;
                background-color: rgba(20, 20, 20, 0.6);
                border-radius: 4px;
                border-left: 3px solid #4a5568;
            }

            .modern-stat-label {
                color: #aaa;
                font-size: 14px;
            }

            .modern-stat-value {
                color: #fff;
                font-weight: bold;
                font-size: 16px;
            }

            /* Inventory Panel - Right Side */
            .modern-inventory-panel {
                display: flex;
                flex-direction: column;
                background-color: #222;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                overflow: hidden;
                min-height: 0;
            }

            .modern-inventory-grid-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #444;
                flex-shrink: 0;
            }

            .modern-inventory-grid-title {
                color: #fff;
                font-size: 22px;
                margin: 0;
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
            }

            .modern-inventory-filter {
                display: flex;
                gap: 8px;
            }

            .modern-filter-btn {
                padding: 8px 16px;
                background-color: #333;
                border: 1px solid #555;
                color: #aaa;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 14px;
                font-weight: 500;
            }

            .modern-filter-btn:hover, .modern-filter-btn.active {
                background-color: #4a9eff;
                border-color: #4a9eff;
                color: white;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }

            .modern-inventory-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
                gap: 12px;
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                background-color: rgba(0, 0, 0, 0.4);
                border-radius: 8px;
                border: 2px dashed #555;
                min-height: 400px;
                max-height: calc(100vh - 400px);
            }

            .modern-inventory-slot {
                width: 90px;
                height: 90px;
                background-color: rgba(40, 40, 40, 0.9);
                border: 2px solid rgba(100, 100, 120, 0.8);
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                padding: 4px;
            }

            .modern-inventory-slot:hover {
                border-color: #4a9eff;
                transform: scale(1.05);
                box-shadow: 0 0 15px rgba(74, 158, 255, 0.5);
            }

            .modern-inventory-slot.selected {
                border-color: #ffd700;
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
                transform: scale(1.08);
                background-color: rgba(80, 60, 0, 0.3);
            }

            .modern-inventory-slot.empty {
                opacity: 0.3;
                border-style: dashed;
                cursor: default;
            }

            .modern-inventory-slot.empty:hover {
                transform: none;
                box-shadow: none;
                border-color: rgba(100, 100, 120, 0.8);
            }

            .modern-item-icon {
                width: 60px;
                height: 60px;
                border-radius: 4px;
                object-fit: contain;
                margin-bottom: 4px;
                filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.7));
            }

            .modern-item-name-small {
                font-size: 10px;
                color: #ddd;
                text-align: center;
                word-wrap: break-word;
                max-width: 100%;
                line-height: 1.1;
                height: 20px;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }

            /* Item rarity styling for inventory items */
            .modern-inventory-slot.common { border-color: #9d9d9d; }
            .modern-inventory-slot.uncommon { border-color: #1eff00; }
            .modern-inventory-slot.rare { border-color: #0070dd; }
            .modern-inventory-slot.epic { border-color: #a335ee; }
            .modern-inventory-slot.legendary { 
                border-color: #ff8000;
                animation: legendary-glow 2s ease-in-out infinite alternate;
            }

            .modern-inventory-slot.common .modern-item-name-small { color: #9d9d9d; }
            .modern-inventory-slot.uncommon .modern-item-name-small { color: #1eff00; }
            .modern-inventory-slot.rare .modern-item-name-small { color: #0070dd; }
            .modern-inventory-slot.epic .modern-item-name-small { color: #a335ee; }
            .modern-inventory-slot.legendary .modern-item-name-small { 
                color: #ff8000;
                text-shadow: 0 0 5px rgba(255, 128, 0, 0.7);
            }

            /* Action Buttons */
            .modern-inventory-actions {
                display: flex;
                gap: 15px;
                justify-content: center;
                padding: 20px;
                margin-top: 20px;
                border-top: 2px solid #444;
                flex-shrink: 0;
            }

            .modern-action-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                transition: all 0.3s;
                min-width: 140px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }

            .modern-equip-btn {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
            }

            .modern-equip-btn:hover:not(:disabled) {
                background: linear-gradient(135deg, #45a049, #3d8b40);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            }

            .modern-equip-btn:disabled {
                background: linear-gradient(135deg, #666, #555);
                color: #999;
                cursor: not-allowed;
                transform: none;
            }

            .modern-unequip-btn {
                background: linear-gradient(135deg, #ff6b6b, #ff5252);
                color: white;
            }

            .modern-unequip-btn:hover:not(:disabled) {
                background: linear-gradient(135deg, #ff5252, #f44336);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            }

            .modern-unequip-btn:disabled {
                background: linear-gradient(135deg, #666, #555);
                color: #999;
                cursor: not-allowed;
            }

            .modern-sort-btn {
                background: linear-gradient(135deg, #2196F3, #1976D2);
                color: white;
            }

            .modern-sort-btn:hover {
                background: linear-gradient(135deg, #1976D2, #1565C0);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            }

            /* Animation for newly equipped items */
            .modern-equipment-slot.just-equipped {
                animation: equip-flash 1s ease;
            }

            @keyframes equip-flash {
                0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
                25% { box-shadow: 0 0 30px rgba(100, 255, 100, 1); }
                50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.8); }
                75% { box-shadow: 0 0 30px rgba(100, 255, 100, 1); }
                100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
            }

            /* Unequip button for equipment slots */
            .modern-equipment-slot.equipped::after {
                content: "✕";
                position: absolute;
                top: -8px;
                right: -8px;
                width: 20px;
                height: 20px;
                background-color: #ff4444;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                opacity: 0;
                transition: opacity 0.3s;
                cursor: pointer;
                z-index: 20;
            }

            .modern-equipment-slot.equipped:hover::after {
                opacity: 1;
            }

            /* Responsive Design */
            @media (max-width: 1400px) {
                .modern-inventory-body {
                    grid-template-columns: 400px 1fr;
                }
                
                .modern-avatar-container {
                    height: 400px;
                }
            }

            @media (max-width: 1200px) {
                .modern-inventory-body {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
                
                .modern-character-overview {
                    max-height: 50vh;
                }
            }

            /* Hidden class */
            .hidden {
                display: none !important;
            }

            /* Custom scrollbar */
            .modern-inventory-grid::-webkit-scrollbar,
            .modern-character-overview::-webkit-scrollbar {
                width: 8px;
            }

            .modern-inventory-grid::-webkit-scrollbar-track,
            .modern-character-overview::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
            }

            .modern-inventory-grid::-webkit-scrollbar-thumb,
            .modern-character-overview::-webkit-scrollbar-thumb {
                background: #4a9eff;
                border-radius: 4px;
            }

            .modern-inventory-grid::-webkit-scrollbar-thumb:hover,
            .modern-character-overview::-webkit-scrollbar-thumb:hover {
                background: #3a8eef;
            }
        `;
        
        document.head.appendChild(style);
    }

    createModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('modern-inventory-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalHTML = `
            <div id="modern-inventory-modal" class="modern-inventory-modal hidden">
                <div class="modern-inventory-container">
                    <!-- Header -->
                    <div class="modern-inventory-header">
                        <h1 class="modern-inventory-title">Character Inventory</h1>
                        <div class="modern-player-gold-display">
                            <div class="modern-gold-icon">🪙</div>
                            <span id="modern-player-gold-amount">0</span>
                            <span>Gold</span>
                        </div>
                        <button class="modern-close-inventory" id="modern-close-inventory">✕ Close</button>
                    </div>

                    <!-- Main Content -->
                    <div class="modern-inventory-body">
                        <!-- Character Overview Panel - Left Side -->
                        <div class="modern-character-overview" id="modern-character-overview">
                            <div class="modern-character-frame">
                                <div class="modern-avatar-container">
                                    <img id="modern-character-avatar" src="" alt="Character Avatar">
                                    <div class="modern-character-class-badge">
                                        <div id="modern-character-class">Class Name</div>
                                        <div id="modern-character-subclass" class="modern-character-subclass">Subclass</div>
                                    </div>
                                    
                                    <!-- Equipment slots as overlay -->
                                    <div class="modern-equipment-slot helmet-slot" data-slot="helmet" title="Helmet - Click to unequip">
                                        <img src="images/slot-helmet.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-helmet-name">None</div>
                                    </div>
                                    
                                    <div class="modern-equipment-slot armor-slot" data-slot="armor" title="Armor - Click to unequip">
                                        <img src="images/slot-armor.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-armor-name">None</div>
                                    </div>
                                    
                                    <div class="modern-equipment-slot shield-slot" data-slot="shield" title="Shield - Click to unequip">
                                        <img src="images/slot-shield.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-shield-name">None</div>
                                    </div>
                                    
                                    <div class="modern-equipment-slot boots-slot" data-slot="boots" title="Boots - Click to unequip">
                                        <img src="images/slot-boots.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-boots-name">None</div>
                                    </div>
                                    
                                    <div class="modern-equipment-slot weapon-slot" data-slot="weapon" title="Weapon - Click to unequip">
                                        <img src="images/slot-sword.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-weapon-name">None</div>
                                    </div>
                                    
                                    <div class="modern-equipment-slot amulet-slot" data-slot="amulet" title="Amulet - Click to unequip">
                                        <img src="images/slot-amulet.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-amulet-name">None</div>
                                    </div>
                                    
                                    <div class="modern-equipment-slot ring-slot" data-slot="ring" title="Ring - Click to unequip">
                                        <img src="images/slot-ring.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-ring-name">None</div>
                                    </div>
                                    
                                    <div class="modern-equipment-slot gloves-slot" data-slot="gloves" title="Gloves - Click to unequip">
                                        <img src="images/slot-gloves.svg" class="modern-slot-icon">
                                        <div class="modern-equipment-name" id="modern-gloves-name">None</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Character Stats -->
                            <div class="modern-character-stats">
                                <h2 class="modern-stats-title">📊 Character Stats</h2>
                                
                                <div class="modern-stat-row">
                                    <span class="modern-stat-label">💪 STRENGTH</span>
                                    <span class="modern-stat-value" id="modern-char-strength">10</span>
                                </div>
                                
                                <div class="modern-stat-row">
                                    <span class="modern-stat-label">🏃 AGILITY</span>
                                    <span class="modern-stat-value" id="modern-char-agility">10</span>
                                </div>
                                
                                <div class="modern-stat-row">
                                    <span class="modern-stat-label">🧠 INTUITION</span>
                                    <span class="modern-stat-value" id="modern-char-intuition">10</span>
                                </div>
                                
                                <div class="modern-stat-row">
                                    <span class="modern-stat-label">❤️ ENDURANCE</span>
                                    <span class="modern-stat-value" id="modern-char-endurance">10</span>
                                </div>
                            </div>
                        </div>

                        <!-- Inventory Panel - Right Side -->
                        <div class="modern-inventory-panel">
                            <div class="modern-inventory-grid-header">
                                <h2 class="modern-inventory-grid-title">🎒 Inventory</h2>
                                <div class="modern-inventory-filter">
                                    <button class="modern-filter-btn active" data-filter="all">All</button>
                                    <button class="modern-filter-btn" data-filter="weapon">⚔️ Weapons</button>
                                    <button class="modern-filter-btn" data-filter="armor">🛡️ Armor</button>
                                    <button class="modern-filter-btn" data-filter="helmet">⛑️ Helmets</button>
                                    <button class="modern-filter-btn" data-filter="accessory">💎 Accessories</button>
                                </div>
                            </div>
                            
                            <div class="modern-inventory-grid" id="modern-inventory-items-grid">
                                <!-- Inventory items will be populated here -->
                            </div>

                            <!-- Action Buttons -->
                            <div class="modern-inventory-actions">
                                <button class="modern-action-btn modern-equip-btn" id="modern-equip-selected-item" disabled>Equip Selected</button>
                                <button class="modern-action-btn modern-unequip-btn" id="modern-unequip-selected-slot" disabled>Unequip Selected</button>
                                <button class="modern-action-btn modern-sort-btn" id="modern-sort-inventory">Sort Items</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to the page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('modern-inventory-modal');
    }

    replaceOldInventory() {
        // Find and replace old inventory button functionality
        const oldInventoryBtn = document.getElementById('open-inventory-btn');
        if (oldInventoryBtn) {
            // Clone button to remove old event listeners
            const newInventoryBtn = oldInventoryBtn.cloneNode(true);
            oldInventoryBtn.parentNode.replaceChild(newInventoryBtn, oldInventoryBtn);
            
            // Add new event listener
            newInventoryBtn.addEventListener('click', () => {
                this.openInventory();
            });
            
            console.log('✅ Replaced old inventory button');
        }

        // Hide old inventory modal if it exists
        const oldModal = document.getElementById('inventory-modal');
        if (oldModal) {
            oldModal.style.display = 'none';
            console.log('✅ Hidden old inventory modal');
        }
    }

    setupEventListeners() {
        // Close modal
        document.getElementById('modern-close-inventory').addEventListener('click', () => {
            this.closeInventory();
        });

        // Filter buttons
        document.querySelectorAll('.modern-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modern-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.updateInventoryGrid();
            });
        });

        // Equipment slots
        document.querySelectorAll('.modern-equipment-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const slotType = slot.dataset.slot;
                
                // Check if clicking on the unequip button (✕)
                if (slot.classList.contains('equipped')) {
                    const rect = slot.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;
                    
                    // Check if click is in the top-right area (unequip button)
                    if (clickX > rect.width - 25 && clickY < 25) {
                        this.unequipItem(slotType);
                        return;
                    }
                }
                
                // Regular slot click - try to equip selected item or highlight compatible
                if (this.selectedItem && this.canEquipItem(this.selectedItem, slotType)) {
                    this.equipItem(this.selectedItem.id, slotType);
                } else {
                    this.highlightCompatibleItems(slotType);
                }
            });
        });

        // Equip selected button
        document.getElementById('modern-equip-selected-item').addEventListener('click', () => {
            if (this.selectedItem) {
                this.equipItem(this.selectedItem.id, this.selectedItem.type);
            }
        });

        // Unequip selected button
        document.getElementById('modern-unequip-selected-slot').addEventListener('click', () => {
            if (this.selectedEquipmentSlot) {
                this.unequipItem(this.selectedEquipmentSlot);
            }
        });

        // Sort inventory button
        document.getElementById('modern-sort-inventory').addEventListener('click', () => {
            this.sortInventory();
        });

        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeInventory();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.closeInventory();
            }
        });
    }

    setupSocketEvents() {
        // Listen for inventory updates from server
        this.socket.on('inventory', (inventoryData) => {
            console.log('📦 Modern inventory received data:', inventoryData);
            this.inventoryData = inventoryData;
            this.updateInventoryDisplay();
        });

        // Listen for equipment updates
        this.socket.on('equipmentUpdated', (data) => {
            console.log('⚔️ Equipment updated:', data);
            if (this.inventoryData) {
                this.inventoryData.equipped = data.equipped;
                this.inventoryData.inventory = data.inventory;
                this.inventoryData.gold = data.gold || this.inventoryData.gold;
                this.updateInventoryDisplay();
                this.showEquipAnimation(data.slotType);
            }
        });

        // Listen for stats updates
        this.socket.on('statsUpdate', (stats) => {
            console.log('📊 Stats updated:', stats);
            this.playerStats = stats;
            this.updateCharacterStats();
        });

        // Listen for profile data (includes stats)
        this.socket.on('profileData', (data) => {
            console.log('👤 Profile data received:', data);
            if (data.stats) {
                this.playerStats = data.stats;
                this.updateCharacterStats();
            }
            if (data.inventory) {
                this.inventoryData = data.inventory;
                this.updateInventoryDisplay();
            }
            
            // Update character data
            if (data.user) {
                this.playerData = data.user;
                this.updateCharacterDisplay();
            }
        });
    }

    openInventory() {
        console.log('🎒 Opening fullscreen modern inventory...');
        
        // Request fresh inventory data
        this.socket.emit('getInventory');
        this.socket.emit('requestStats');
        this.socket.emit('getProfile');
        
        // Show modal
        this.modal.classList.remove('hidden');
        
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';
    }

    closeInventory() {
        console.log('🎒 Closing fullscreen modern inventory...');
        this.modal.classList.add('hidden');
        this.clearSelection();
        
        // Restore body scrolling
        document.body.style.overflow = '';
    }

    updateInventoryDisplay() {
        if (!this.inventoryData) return;

        console.log('🔄 Updating inventory display with:', this.inventoryData);

        // Update gold
        document.getElementById('modern-player-gold-amount').textContent = this.inventoryData.gold || 0;

        // Update equipped items
        this.updateEquippedItems();

        // Update inventory grid
        this.updateInventoryGrid();
    }

    updateEquippedItems() {
        if (!this.inventoryData.equipped) return;

        const slots = ['helmet', 'weapon', 'armor', 'shield', 'boots', 'gloves', 'ring', 'amulet'];
        
        slots.forEach(slotType => {
            const slot = document.querySelector(`[data-slot="${slotType}"]`);
            const nameElement = document.getElementById(`modern-${slotType}-name`);
            
            if (!slot || !nameElement) return;
            
            if (this.inventoryData.equipped[slotType]) {
                const item = this.inventoryData.equipped[slotType];
                
                // Update visual
                slot.classList.add('equipped');
                this.addRarityClass(slot, item.rarity);
                nameElement.textContent = item.name;
                
                // Update icon with item image or fallback
                const slotIcon = slot.querySelector('.modern-slot-icon');
                if (slotIcon) {
                    if (item.image) {
                        slotIcon.src = item.image;
                        slotIcon.onerror = () => {
                            console.warn(`Failed to load item image: ${item.image}, using fallback`);
                            slotIcon.src = this.getDefaultSlotIcon(slotType);
                        };
                    } else {
                        slotIcon.src = this.getDefaultSlotIcon(slotType);
                    }
                }
                
                // Update tooltip
                slot.title = `${item.name} - Click to unequip`;
                
                console.log(`✅ Updated ${slotType} slot with ${item.name}`);
            } else {
                slot.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');
                nameElement.textContent = 'None';
                
                // Reset to default slot icon
                const slotIcon = slot.querySelector('.modern-slot-icon');
                if (slotIcon) {
                    slotIcon.src = this.getDefaultSlotIcon(slotType);
                }
                
                slot.title = `${slotType.charAt(0).toUpperCase() + slotType.slice(1)} - Empty`;
            }
        });
    }

  updateInventoryGrid() {
    if (!this.inventoryData || !this.inventoryData.inventory) return;

    const grid = document.getElementById('modern-inventory-items-grid');
    grid.innerHTML = '';

    // Filter items
    const filteredItems = this.inventoryData.inventory.filter(item => {
        if (this.currentFilter === 'all') return true;
        if (this.currentFilter === 'accessory') {
            return ['ring', 'amulet', 'boots', 'gloves'].includes(item.type);
        }
        return item.type === this.currentFilter;
    });

    console.log(`🔍 Filtered ${filteredItems.length} items for category: ${this.currentFilter}`);

    // Create inventory slots - dynamic based on content
    const minSlots = 24;
    const totalSlots = Math.max(minSlots, Math.ceil(filteredItems.length / 6) * 6);
    
    for (let i = 0; i < totalSlots; i++) {
        const slot = document.createElement('div');
        slot.className = 'modern-inventory-slot';
        
        if (i < filteredItems.length) {
            const item = filteredItems[i];
            this.addRarityClass(slot, item.rarity);
            
            // Create item display
            const itemIcon = document.createElement('img');
            itemIcon.className = 'modern-item-icon';
            itemIcon.alt = item.name;
            
            // Set item image with absolute paths and fallback
            if (item.image) {
                // Ensure absolute path
                const imagePath = item.image.startsWith('/') ? item.image : `/${item.image}`;
                itemIcon.src = imagePath;
                itemIcon.onerror = () => {
                    console.warn(`Failed to load inventory item image: ${item.image}, using fallback.`);
                    itemIcon.src = this.getDefaultSlotIcon(item.type); // This now returns absolute paths
                };
            } else {
                itemIcon.src = this.getDefaultSlotIcon(item.type); // This now returns absolute paths
            }
            
            const itemName = document.createElement('div');
            itemName.className = 'modern-item-name-small';
            itemName.textContent = item.name;
            
            slot.appendChild(itemIcon);
            slot.appendChild(itemName);
            
            // Store item data
            slot.itemData = item;
            
            // Add click event
            slot.addEventListener('click', () => this.selectItem(item, slot));
            
            // Add tooltip
            slot.title = this.getItemTooltip(item);
            
            console.log(`📦 Added item to grid: ${item.name} (${item.type})`);
        } else {
            slot.classList.add('empty');
        }
        
        grid.appendChild(slot);
    }
}

    updateCharacterStats() {
        if (!this.playerStats) return;

        document.getElementById('modern-char-strength').textContent = this.playerStats.strength || 10;
        document.getElementById('modern-char-agility').textContent = this.playerStats.agility || 10;
        document.getElementById('modern-char-intuition').textContent = this.playerStats.intuition || 10;
        document.getElementById('modern-char-endurance').textContent = this.playerStats.endurance || 10;
    }

   updateCharacterDisplay() {
    if (!this.playerData) return;

    const avatarElement = document.getElementById('modern-character-avatar');
    const classElement = document.getElementById('modern-character-class');
    const subclassElement = document.getElementById('modern-character-subclass');
    const overviewElement = document.getElementById('modern-character-overview');

    // Set character avatar with absolute paths
    if (this.playerData.characterClass && this.playerData.characterClass !== 'unselected') {
        const characterImagePath = `/images/characters/${this.playerData.characterClass}.png`; // Changed: Added leading slash
        avatarElement.src = characterImagePath;
        avatarElement.onerror = () => {
            console.warn('Character class image failed to load, using default avatar');
            const avatarSrc = this.playerData.avatar?.startsWith('/images/') || this.playerData.avatar?.startsWith('images/') ? 
                (this.playerData.avatar.startsWith('/') ? this.playerData.avatar : `/${this.playerData.avatar}`) : 
                `/images/${this.playerData.avatar || 'default-avatar.png'}`; // Changed: Ensure absolute path
            avatarElement.src = avatarSrc;
        };
        
        // Add character class styling
        overviewElement.className = 'modern-character-overview';
        overviewElement.classList.add(this.playerData.characterClass);
        
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
        // Fallback to regular avatar with absolute path
        const avatarSrc = this.playerData.avatar?.startsWith('/images/') || this.playerData.avatar?.startsWith('images/') ? 
            (this.playerData.avatar.startsWith('/') ? this.playerData.avatar : `/${this.playerData.avatar}`) : 
            `/images/${this.playerData.avatar || 'default-avatar.png'}`; // Changed: Ensure absolute path
        avatarElement.src = avatarSrc;
        
        classElement.textContent = 'No Class';
        subclassElement.textContent = 'Unassigned';
    }
}

    selectItem(item, slotElement) {
        // Remove previous selections
        document.querySelectorAll('.modern-inventory-slot').forEach(s => {
            s.classList.remove('selected');
        });
        document.querySelectorAll('.modern-equipment-slot').forEach(s => {
            s.classList.remove('selected');
        });
        
        // Add selection to current slot
        slotElement.classList.add('selected');
        
        this.selectedItem = item;
        this.selectedEquipmentSlot = null;
        
        // Enable equip button
        const equipBtn = document.getElementById('modern-equip-selected-item');
        equipBtn.disabled = false;
        equipBtn.textContent = `Equip ${item.name}`;
        
        // Disable unequip button
        const unequipBtn = document.getElementById('modern-unequip-selected-slot');
        unequipBtn.disabled = true;
        unequipBtn.textContent = 'Unequip Selected';
        
        console.log('🎯 Selected item:', item);
    }

    selectEquipmentSlot(slotType) {
        // Remove previous selections
        document.querySelectorAll('.modern-inventory-slot').forEach(s => {
            s.classList.remove('selected');
        });
        document.querySelectorAll('.modern-equipment-slot').forEach(s => {
            s.classList.remove('selected');
        });
        
        // Add selection to equipment slot
        const slotElement = document.querySelector(`[data-slot="${slotType}"]`);
        if (slotElement) {
            slotElement.classList.add('selected');
        }
        
        this.selectedItem = null;
        this.selectedEquipmentSlot = slotType;
        
        // Disable equip button
        const equipBtn = document.getElementById('modern-equip-selected-item');
        equipBtn.disabled = true;
        equipBtn.textContent = 'Equip Selected';
        
        // Enable unequip button if slot has item
        const unequipBtn = document.getElementById('modern-unequip-selected-slot');
        if (this.inventoryData.equipped[slotType]) {
            unequipBtn.disabled = false;
            unequipBtn.textContent = `Unequip ${this.inventoryData.equipped[slotType].name}`;
        } else {
            unequipBtn.disabled = true;
            unequipBtn.textContent = 'Unequip Selected';
        }
        
        console.log('🎯 Selected equipment slot:', slotType);
    }

    clearSelection() {
        this.selectedItem = null;
        this.selectedEquipmentSlot = null;
        
        document.querySelectorAll('.modern-inventory-slot').forEach(s => {
            s.classList.remove('selected');
        });
        document.querySelectorAll('.modern-equipment-slot').forEach(s => {
            s.classList.remove('selected');
        });
        
        const equipBtn = document.getElementById('modern-equip-selected-item');
        equipBtn.disabled = true;
        equipBtn.textContent = 'Equip Selected';
        
        const unequipBtn = document.getElementById('modern-unequip-selected-slot');
        unequipBtn.disabled = true;
        unequipBtn.textContent = 'Unequip Selected';
    }

    highlightCompatibleItems(slotType) {
        // Remove existing highlights
        document.querySelectorAll('.modern-inventory-slot').forEach(slot => {
            slot.classList.remove('highlighted');
        });
        
        // Highlight compatible items
        document.querySelectorAll('.modern-inventory-slot').forEach(slot => {
            if (slot.itemData && this.canEquipItem(slot.itemData, slotType)) {
                slot.style.boxShadow = '0 0 15px rgba(100, 255, 100, 0.8)';
                setTimeout(() => {
                    slot.style.boxShadow = '';
                }, 2000);
            }
        });
        
        console.log(`💡 Highlighted items compatible with ${slotType} slot`);
    }

    canEquipItem(item, slotType) {
        return item.type === slotType;
    }

    equipItem(itemId, itemType) {
        console.log('⚔️ Equipping item:', itemId, itemType);
        
        // Send equip request to server
        this.socket.emit('equipItem', { itemId, itemType });
        
        // Clear selection
        this.clearSelection();
    }

    unequipItem(slotType) {
        console.log('🔄 Unequipping item from slot:', slotType);
        
        // Send unequip request to server
        this.socket.emit('unequipItem', { slotType });
        
        // Clear selection
        this.clearSelection();
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
        weapon: '/images/slot-sword.svg',      // Changed: Added leading slash
        armor: '/images/slot-armor.svg',      // Changed: Added leading slash
        helmet: '/images/slot-helmet.svg',    // Changed: Added leading slash
        shield: '/images/slot-shield.svg',    // Changed: Added leading slash
        ring: '/images/slot-ring.svg',        // Changed: Added leading slash
        amulet: '/images/slot-amulet.svg',    // Changed: Added leading slash
        boots: '/images/slot-boots.svg',      // Changed: Added leading slash
        gloves: '/images/slot-gloves.svg'     // Changed: Added leading slash
    };
    
    return iconMap[itemType] || '/images/slot-default.svg'; // Changed: Added leading slash
}

    getItemTooltip(item) {
        let tooltip = `${item.name}\n`;
        if (item.damage) tooltip += `+${item.damage} Damage\n`;
        if (item.defense) tooltip += `+${item.defense} Defense\n`;
        if (item.description) tooltip += `${item.description}`;
        return tooltip.trim();
    }

    sortInventory() {
        if (!this.inventoryData || !this.inventoryData.inventory) return;
        
        // Sort by rarity first, then by name
        const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
        
        this.inventoryData.inventory.sort((a, b) => {
            const rarityDiff = (rarityOrder[b.rarity] || 1) - (rarityOrder[a.rarity] || 1);
            if (rarityDiff !== 0) return rarityDiff;
            return a.name.localeCompare(b.name);
        });
        
        this.updateInventoryGrid();
        console.log('📋 Inventory sorted by rarity and name');
    }

    // Public method to check if inventory is open
    isOpen() {
        return !this.modal.classList.contains('hidden');
    }
}

// Safe global initialization
(function() {
    'use strict';
    
    // Wait for socket to be available
    function initWhenReady() {
        if (typeof socket !== 'undefined' && socket) {
            // Initialize the modern inventory system
            if (!window.modernInventorySystem) {
                window.modernInventorySystem = new ModernInventorySystem(socket);
                console.log('✅ Fullscreen Modern Inventory System initialized');
            }
        } else {
            // Check again in a bit
            setTimeout(initWhenReady, 500);
        }
    }
    
    // Auto-initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady);
    } else {
        initWhenReady();
    }
    
    // Also make it available as a global function for manual initialization
    window.initModernInventory = function(socketInstance) {
        if (!window.modernInventorySystem) {
            window.modernInventorySystem = new ModernInventorySystem(socketInstance);
            console.log('✅ Fullscreen Modern Inventory System manually initialized');
        }
        return window.modernInventorySystem;
    };
})();

