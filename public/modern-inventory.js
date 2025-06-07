// modern-inventory.js - Safe integration with existing game
// This replaces the old inventory without breaking anything

class ModernInventorySystem {
    constructor(socket) {
        this.socket = socket;
        this.selectedItem = null;
        this.currentFilter = 'all';
        this.inventoryData = null;
        this.playerStats = null;
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
        console.log('🎒 Initializing Modern Inventory System...');
        
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
        console.log('✅ Modern Inventory System ready!');
    }

    addStyles() {
        // Only add styles if not already added
        if (document.getElementById('modern-inventory-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'modern-inventory-styles';
        style.textContent = `
            /* Modern Inventory Styles */
            .modern-inventory-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                backdrop-filter: blur(5px);
            }

            .modern-inventory-container {
                background: linear-gradient(145deg, #1a1a2e, #16213e);
                border: 3px solid #4a5568;
                border-radius: 20px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8), 
                           inset 0 1px 0 rgba(255, 255, 255, 0.1);
                width: 95%;
                max-width: 1200px;
                height: 85%;
                max-height: 800px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;
                animation: modalSlideIn 0.3s ease-out;
            }

            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-50px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            .modern-inventory-header {
                background: linear-gradient(90deg, #2d3748, #4a5568);
                padding: 20px 30px;
                border-bottom: 2px solid #1a202c;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            }

            .modern-inventory-title {
                color: #f7fafc;
                font-size: 28px;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
                margin: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .modern-player-gold-display {
                display: flex;
                align-items: center;
                gap: 12px;
                color: #ffd700;
                font-size: 20px;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
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
                background: linear-gradient(145deg, #e53e3e, #c53030);
                border: none;
                color: white;
                padding: 12px 20px;
                border-radius: 10px;
                cursor: pointer;
                font-weight: bold;
                font-size: 16px;
                transition: all 0.3s;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }

            .modern-close-inventory:hover {
                background: linear-gradient(145deg, #c53030, #9c2626);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            }

            .modern-inventory-body {
                display: flex;
                flex: 1;
                overflow: hidden;
            }

            /* Character Equipment Panel */
            .modern-character-panel {
                flex: 0 0 420px;
                background: linear-gradient(145deg, #2d3748, #1a202c);
                border-right: 3px solid #4a5568;
                padding: 25px;
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                overflow-y: auto;
            }

            .modern-character-display {
                position: relative;
                width: 240px;
                height: 320px;
                margin: 25px 0;
                background: radial-gradient(circle, rgba(74, 85, 104, 0.1), transparent);
                border-radius: 50%;
            }

            .modern-character-avatar {
                width: 140px;
                height: 140px;
                border-radius: 50%;
                border: 5px solid #4a5568;
                box-shadow: 0 0 30px rgba(74, 85, 104, 0.7);
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 3;
                transition: all 0.3s ease;
                object-fit: cover;
            }

            .modern-character-avatar:hover {
                border-color: #63b3ed;
                box-shadow: 0 0 40px rgba(99, 179, 237, 0.8);
                transform: translate(-50%, -50%) scale(1.05);
            }

            /* Equipment Slots */
            .modern-equipment-slot {
                position: absolute;
                width: 70px;
                height: 70px;
                background: linear-gradient(145deg, #1a202c, #2d3748);
                border: 3px solid #4a5568;
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.4), 
                           0 4px 8px rgba(0, 0, 0, 0.3);
                overflow: visible;
            }

            .modern-equipment-slot:hover {
                border-color: #63b3ed;
                box-shadow: 0 0 20px rgba(99, 179, 237, 0.5), 
                           inset 0 3px 6px rgba(0, 0, 0, 0.4);
                transform: scale(1.1);
            }

            .modern-equipment-slot.equipped {
                border-color: #48bb78;
                box-shadow: 0 0 25px rgba(72, 187, 120, 0.6), 
                           inset 0 3px 6px rgba(0, 0, 0, 0.4);
                animation: equipPulse 3s ease-in-out infinite;
            }

            @keyframes equipPulse {
                0%, 100% { 
                    box-shadow: 0 0 25px rgba(72, 187, 120, 0.6), 
                               inset 0 3px 6px rgba(0, 0, 0, 0.4); 
                }
                50% { 
                    box-shadow: 0 0 35px rgba(72, 187, 120, 0.8), 
                               inset 0 3px 6px rgba(0, 0, 0, 0.4); 
                }
            }

            /* Slot Positioning - Arranged around character */
            .helmet-slot { top: -10px; left: 50%; transform: translateX(-50%); }
            .amulet-slot { top: 30px; right: -15px; }
            .gloves-slot { top: 30px; left: -15px; }
            .weapon-slot { top: 90px; left: -25px; }
            .armor-slot { top: 130px; right: -25px; }
            .shield-slot { top: 180px; left: -25px; }
            .ring-slot { top: 220px; right: -15px; }
            .boots-slot { bottom: -10px; left: 50%; transform: translateX(-50%); }

            .modern-slot-icon {
                width: 40px;
                height: 40px;
                opacity: 0.7;
                transition: opacity 0.3s;
                filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.5));
            }

            .modern-equipment-slot:hover .modern-slot-icon {
                opacity: 1;
            }

            .modern-equipment-name {
                position: absolute;
                bottom: -30px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 11px;
                color: #a0aec0;
                text-align: center;
                min-width: 90px;
                word-wrap: break-word;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
                font-weight: 500;
            }

            .equipped .modern-equipment-name {
                color: #68d391;
                font-weight: bold;
            }

            /* Character Stats Display */
            .modern-character-stats {
                width: 100%;
                background: linear-gradient(145deg, #1a202c, #2d3748);
                border-radius: 15px;
                padding: 20px;
                margin-top: 25px;
                border: 2px solid #4a5568;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .modern-stats-title {
                color: #f7fafc;
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                text-align: center;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
            }

            .modern-stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                color: #e2e8f0;
                padding: 8px 12px;
                background: rgba(26, 32, 44, 0.3);
                border-radius: 8px;
                border-left: 3px solid #4a5568;
            }

            .modern-stat-name {
                font-size: 14px;
                opacity: 0.9;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .modern-stat-value {
                font-weight: bold;
                color: #63b3ed;
                font-size: 16px;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
            }

            /* Inventory Grid Panel */
            .modern-inventory-panel {
                flex: 1;
                padding: 25px;
                background: linear-gradient(145deg, #1a202c, #2d3748);
                display: flex;
                flex-direction: column;
            }

            .modern-inventory-grid-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #4a5568;
            }

            .modern-inventory-grid-title {
                color: #f7fafc;
                font-size: 22px;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
            }

            .modern-inventory-filter {
                display: flex;
                gap: 12px;
            }

            .modern-filter-btn {
                padding: 8px 16px;
                background: linear-gradient(145deg, #4a5568, #2d3748);
                border: 2px solid #718096;
                color: #e2e8f0;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .modern-filter-btn:hover, .modern-filter-btn.active {
                background: linear-gradient(145deg, #63b3ed, #3182ce);
                border-color: #63b3ed;
                color: white;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
            }

            .modern-inventory-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 12px;
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                background: rgba(26, 32, 44, 0.6);
                border-radius: 15px;
                border: 3px dashed #4a5568;
                box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
            }

            .modern-inventory-slot {
                width: 80px;
                height: 80px;
                background: linear-gradient(145deg, #2d3748, #1a202c);
                border: 3px solid #4a5568;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
            }

            .modern-inventory-slot:hover {
                border-color: #63b3ed;
                box-shadow: 0 0 20px rgba(99, 179, 237, 0.5), 
                           inset 0 2px 6px rgba(0, 0, 0, 0.4);
                transform: scale(1.05);
            }

            .modern-inventory-slot.selected {
                border-color: #ffd700 !important;
                box-shadow: 0 0 25px rgba(255, 215, 0, 0.7), 
                           inset 0 2px 6px rgba(0, 0, 0, 0.4) !important;
                transform: scale(1.1) !important;
            }

            .modern-inventory-slot.empty {
                opacity: 0.4;
                border-style: dashed;
                cursor: default;
            }

            .modern-item-icon {
                width: 50px;
                height: 50px;
                border-radius: 8px;
                filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.5));
            }

            .modern-item-quality-border {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border-radius: 12px;
                pointer-events: none;
            }

            /* Item Rarity Colors - Enhanced */
            .common { border-color: #9ca3af; }
            .uncommon { border-color: #10b981; }
            .rare { border-color: #3b82f6; }
            .epic { border-color: #8b5cf6; }
            .legendary { border-color: #f59e0b; }

            .common .modern-item-quality-border { 
                box-shadow: inset 0 0 15px rgba(156, 163, 175, 0.4); 
            }
            .uncommon .modern-item-quality-border { 
                box-shadow: inset 0 0 15px rgba(16, 185, 129, 0.4);
                animation: uncommonGlow 2s ease-in-out infinite alternate;
            }
            .rare .modern-item-quality-border { 
                box-shadow: inset 0 0 15px rgba(59, 130, 246, 0.4);
                animation: rareGlow 2s ease-in-out infinite alternate;
            }
            .epic .modern-item-quality-border { 
                box-shadow: inset 0 0 15px rgba(139, 92, 246, 0.4);
                animation: epicGlow 2s ease-in-out infinite alternate;
            }
            .legendary .modern-item-quality-border { 
                box-shadow: inset 0 0 15px rgba(245, 158, 11, 0.4);
                animation: legendaryGlow 2s ease-in-out infinite alternate;
            }

            @keyframes uncommonGlow {
                from { box-shadow: inset 0 0 15px rgba(16, 185, 129, 0.4); }
                to { box-shadow: inset 0 0 25px rgba(16, 185, 129, 0.6); }
            }

            @keyframes rareGlow {
                from { box-shadow: inset 0 0 15px rgba(59, 130, 246, 0.4); }
                to { box-shadow: inset 0 0 25px rgba(59, 130, 246, 0.6); }
            }

            @keyframes epicGlow {
                from { box-shadow: inset 0 0 15px rgba(139, 92, 246, 0.4); }
                to { box-shadow: inset 0 0 25px rgba(139, 92, 246, 0.6); }
            }

            @keyframes legendaryGlow {
                from { box-shadow: inset 0 0 15px rgba(245, 158, 11, 0.4); }
                to { box-shadow: inset 0 0 25px rgba(245, 158, 11, 0.6); }
            }

            /* Item Tooltip */
            .modern-item-tooltip {
                position: absolute;
                background: linear-gradient(145deg, #1a202c, #2d3748);
                border: 2px solid #4a5568;
                border-radius: 10px;
                padding: 15px;
                color: #f7fafc;
                font-size: 13px;
                z-index: 10001;
                min-width: 220px;
                max-width: 300px;
                box-shadow: 0 15px 30px rgba(0, 0, 0, 0.7);
                pointer-events: none;
                animation: tooltipFadeIn 0.2s ease-out;
            }

            @keyframes tooltipFadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .modern-tooltip-title {
                font-weight: bold;
                margin-bottom: 8px;
                font-size: 16px;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
            }

            .modern-tooltip-stats {
                color: #68d391;
                margin-bottom: 6px;
                font-weight: 500;
            }

            .modern-tooltip-description {
                color: #a0aec0;
                font-style: italic;
                margin-top: 8px;
                line-height: 1.4;
            }

            /* Action Buttons */
            .modern-inventory-actions {
                display: flex;
                gap: 15px;
                justify-content: center;
                padding: 20px;
                border-top: 3px solid #4a5568;
                background: linear-gradient(90deg, #2d3748, #4a5568);
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
            }

            .modern-action-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                transition: all 0.3s;
                min-width: 120px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }

            .modern-equip-btn {
                background: linear-gradient(145deg, #48bb78, #38a169);
                color: white;
            }

            .modern-equip-btn:hover:not(:disabled) {
                background: linear-gradient(145deg, #38a169, #2f855a);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            }

            .modern-equip-btn:disabled {
                background: linear-gradient(145deg, #4a5568, #2d3748);
                color: #a0aec0;
                cursor: not-allowed;
                transform: none;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .modern-sort-btn {
                background: linear-gradient(145deg, #667eea, #764ba2);
                color: white;
            }

            .modern-sort-btn:hover {
                background: linear-gradient(145deg, #5a67d8, #6b46c1);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .modern-inventory-container {
                    width: 100%;
                    height: 100%;
                    border-radius: 0;
                }

                .modern-inventory-body {
                    flex-direction: column;
                }

                .modern-character-panel {
                    flex: 0 0 350px;
                    border-right: none;
                    border-bottom: 3px solid #4a5568;
                }

                .modern-character-display {
                    width: 180px;
                    height: 240px;
                }

                .modern-character-avatar {
                    width: 100px;
                    height: 100px;
                }

                .modern-equipment-slot {
                    width: 55px;
                    height: 55px;
                }

                .modern-slot-icon {
                    width: 30px;
                    height: 30px;
                }

                .modern-inventory-grid {
                    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                }

                .modern-inventory-slot {
                    width: 70px;
                    height: 70px;
                }
            }

            /* Hidden class */
            .hidden {
                display: none !important;
            }

            /* Animation for new items */
            @keyframes itemAdded {
                0% {
                    transform: scale(0.8);
                    opacity: 0;
                }
                50% {
                    transform: scale(1.1);
                }
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            .modern-item-added {
                animation: itemAdded 0.4s ease-out;
            }
        `;
        
        document.head.appendChild(style);
    }

    createModal() {
        // Only create modal if it doesn't exist
        if (document.getElementById('modern-inventory-modal')) return;
        
        const modalHTML = `
            <div id="modern-inventory-modal" class="modern-inventory-modal hidden">
                <div class="modern-inventory-container">
                    <!-- Header -->
                    <div class="modern-inventory-header">
                        <h2 class="modern-inventory-title">⚔️ Character Inventory</h2>
                        <div class="modern-player-gold-display">
                            <div class="modern-gold-icon">🪙</div>
                            <span id="modern-player-gold-amount">0</span>
                            <span>Gold</span>
                        </div>
                        <button class="modern-close-inventory" id="modern-close-inventory">✕</button>
                    </div>

                    <!-- Main Content -->
                    <div class="modern-inventory-body">
                        <!-- Character Equipment Panel -->
                        <div class="modern-character-panel">
                            <!-- Character Display with Equipment Slots -->
                            <div class="modern-character-display">
                                <!-- Character Avatar -->
                                <img id="modern-inventory-character-avatar" class="modern-character-avatar" src="images/default-avatar.png" alt="Character">
                                
                                <!-- Equipment Slots Positioned Around Character -->
                                <div class="modern-equipment-slot helmet-slot" data-slot="helmet" title="Helmet">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8 2 6 4 6 8v4c0 2 1 3 2 4h8c1-1 2-2 2-4V8c0-4-2-6-6-6z'/%3E%3C/svg%3E" alt="Helmet">
                                    <div class="modern-equipment-name" id="modern-equipped-helmet-name">None</div>
                                </div>

                                <div class="modern-equipment-slot amulet-slot" data-slot="amulet" title="Amulet">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8'/%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3C/svg%3E" alt="Amulet">
                                    <div class="modern-equipment-name" id="modern-equipped-amulet-name">None</div>
                                </div>

                                <div class="modern-equipment-slot gloves-slot" data-slot="gloves" title="Gloves">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M8 2v6h8V2H8zm0 8v6c0 2 2 4 4 4s4-2 4-4v-6H8z'/%3E%3C/svg%3E" alt="Gloves">
                                    <div class="modern-equipment-name" id="modern-equipped-gloves-name">None</div>
                                </div>

                                <div class="modern-equipment-slot weapon-slot" data-slot="weapon" title="Weapon">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M6.92 5L5 6.92l2.83 2.83L6.92 5zm4.24 4.24L5 15.4l3.54 3.54 6.16-6.16-3.54-3.54z'/%3E%3C/svg%3E" alt="Weapon">
                                    <div class="modern-equipment-name" id="modern-equipped-weapon-name">None</div>
                                </div>

                                <div class="modern-equipment-slot armor-slot" data-slot="armor" title="Armor">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E" alt="Armor">
                                    <div class="modern-equipment-name" id="modern-equipped-armor-name">None</div>
                                </div>

                                <div class="modern-equipment-slot shield-slot" data-slot="shield" title="Shield">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z'/%3E%3C/svg%3E" alt="Shield">
                                    <div class="modern-equipment-name" id="modern-equipped-shield-name">None</div>
                                </div>

                                <div class="modern-equipment-slot ring-slot" data-slot="ring" title="Ring">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ccircle cx='12' cy='12' r='6'/%3E%3C/svg%3E" alt="Ring">
                                    <div class="modern-equipment-name" id="modern-equipped-ring-name">None</div>
                                </div>

                                <div class="modern-equipment-slot boots-slot" data-slot="boots" title="Boots">
                                    <img class="modern-slot-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M4 18h16v2H4v-2zm0-4h16v2H4v-2zm0-4h16v2H4v-2z'/%3E%3C/svg%3E" alt="Boots">
                                    <div class="modern-equipment-name" id="modern-equipped-boots-name">None</div>
                                </div>
                            </div>

                            <!-- Character Stats -->
                            <div class="modern-character-stats">
                                <div class="modern-stats-title">📊 Character Stats</div>
                                <div class="modern-stat-row">
                                    <span class="modern-stat-name">💪 Strength:</span>
                                    <span class="modern-stat-value" id="modern-char-strength">10</span>
                                </div>
                                <div class="modern-stat-row">
                                    <span class="modern-stat-name">🏃 Agility:</span>
                                    <span class="modern-stat-value" id="modern-char-agility">10</span>
                                </div>
                                <div class="modern-stat-row">
                                    <span class="modern-stat-name">🧠 Intuition:</span>
                                    <span class="modern-stat-value" id="modern-char-intuition">10</span>
                                </div>
                                <div class="modern-stat-row">
                                    <span class="modern-stat-name">❤️ Endurance:</span>
                                    <span class="modern-stat-value" id="modern-char-endurance">10</span>
                                </div>
                            </div>
                        </div>

                        <!-- Inventory Grid Panel -->
                        <div class="modern-inventory-panel">
                            <div class="modern-inventory-grid-header">
                                <h3 class="modern-inventory-grid-title">🎒 Inventory</h3>
                                <div class="modern-inventory-filter">
                                    <button class="modern-filter-btn active" data-filter="all">All</button>
                                    <button class="modern-filter-btn" data-filter="weapon">⚔️</button>
                                    <button class="modern-filter-btn" data-filter="armor">🛡️</button>
                                    <button class="modern-filter-btn" data-filter="helmet">⛑️</button>
                                    <button class="modern-filter-btn" data-filter="accessory">💎</button>
                                </div>
                            </div>
                            
                            <div class="modern-inventory-grid" id="modern-inventory-items-grid">
                                <!-- Inventory items will be populated here -->
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="modern-inventory-actions">
                        <button class="modern-action-btn modern-equip-btn" id="modern-equip-selected-item" disabled>Equip Selected</button>
                        <button class="modern-action-btn modern-sort-btn" id="modern-sort-inventory">Sort Items</button>
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
            slot.addEventListener('click', () => {
                const slotType = slot.dataset.slot;
                if (this.selectedItem && this.canEquipItem(this.selectedItem, slotType)) {
                    this.equipItem(this.selectedItem.id, slotType);
                }
            });
        });

        // Equip selected button
        document.getElementById('modern-equip-selected-item').addEventListener('click', () => {
            if (this.selectedItem) {
                this.equipItem(this.selectedItem.id, this.selectedItem.type);
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
                this.updateInventoryDisplay();
                this.showEquipAnimation();
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
            
            // Update character avatar
            if (data.user) {
                this.updateCharacterAvatar(data.user);
            }
        });
    }

    openInventory() {
        console.log('🎒 Opening modern inventory...');
        
        // Request fresh inventory data
        this.socket.emit('getInventory');
        this.socket.emit('requestStats');
        
        // Show modal
        this.modal.classList.remove('hidden');
    }

    closeInventory() {
        console.log('🎒 Closing modern inventory...');
        this.modal.classList.add('hidden');
        this.clearSelection();
    }

    updateInventoryDisplay() {
        if (!this.inventoryData) return;

        console.log('🔄 Updating inventory display with:', this.inventoryData);

        // Update gold
        document.getElementById('modern-player-gold-amount').textContent = this.inventoryData.gold;

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
            const nameElement = document.getElementById(`modern-equipped-${slotType}-name`);
            
            if (!slot || !nameElement) return;
            
            if (this.inventoryData.equipped[slotType]) {
                const item = this.inventoryData.equipped[slotType];
                slot.classList.add('equipped');
                this.addRarityClass(slot, item.rarity);
                nameElement.textContent = item.name;
                
                // Add tooltip
                this.addTooltip(slot, item);
            } else {
                slot.classList.remove('equipped', 'common', 'uncommon', 'rare', 'epic', 'legendary');
                nameElement.textContent = 'None';
                this.removeTooltip(slot);
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

        // Create inventory slots
        const totalSlots = 24;
        for (let i = 0; i < totalSlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'modern-inventory-slot';
            
            if (i < filteredItems.length) {
                const item = filteredItems[i];
                this.addRarityClass(slot, item.rarity);
                
                slot.innerHTML = `
                    <img class="modern-item-icon" src="${this.getItemIcon(item)}" alt="${item.name}">
                    <div class="modern-item-quality-border"></div>
                `;
                
                // Add click event
                slot.addEventListener('click', () => this.selectItem(item, slot));
                
                // Add tooltip
                this.addTooltip(slot, item);
                
                // Add animation for new items
                slot.classList.add('modern-item-added');
                setTimeout(() => slot.classList.remove('modern-item-added'), 400);
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

    updateCharacterAvatar(userData) {
        const avatarElement = document.getElementById('modern-inventory-character-avatar');
        if (!avatarElement || !userData) return;

        let avatarSrc;
        
        // Check if user has a character class with custom avatar
        if (userData.characterClass && userData.characterClass !== 'unselected') {
            avatarSrc = `/images/characters/${userData.characterClass}.png`;
        } else {
            // Use regular avatar
            avatarSrc = userData.avatar;
            if (avatarSrc && !avatarSrc.startsWith('images/')) {
                avatarSrc = `images/${avatarSrc}`;
            } else if (!avatarSrc) {
                avatarSrc = 'images/default-avatar.png';
            }
        }
        
        avatarElement.src = avatarSrc;
        
        // Add character class styling
        const characterDisplay = document.querySelector('.modern-character-display');
        if (userData.characterClass && userData.characterClass !== 'unselected') {
            characterDisplay.classList.add(userData.characterClass);
        }
    }

    selectItem(item, slotElement) {
        // Remove previous selection
        document.querySelectorAll('.modern-inventory-slot').forEach(s => {
            s.classList.remove('selected');
        });
        
        // Add selection to current slot
        slotElement.classList.add('selected');
        
        this.selectedItem = item;
        
        // Enable equip button
        const equipBtn = document.getElementById('modern-equip-selected-item');
        equipBtn.disabled = false;
        equipBtn.textContent = `Equip ${item.name}`;
        
        console.log('🎯 Selected item:', item);
    }

    clearSelection() {
        this.selectedItem = null;
        document.querySelectorAll('.modern-inventory-slot').forEach(s => {
            s.classList.remove('selected');
        });
        
        const equipBtn = document.getElementById('modern-equip-selected-item');
        equipBtn.disabled = true;
        equipBtn.textContent = 'Equip Selected';
    }

    canEquipItem(item, slotType) {
        return item.type === slotType;
    }

    equipItem(itemId, itemType) {
        console.log('⚔️ Equipping item:', itemId, itemType);
        
        // Send equip request to server using existing socket event
        this.socket.emit('equipItem', { itemId, itemType });
        
        // Clear selection
        this.clearSelection();
    }

    showEquipAnimation() {
        // Add a brief flash animation to show item was equipped
        const container = this.modal.querySelector('.modern-inventory-container');
        container.style.boxShadow = '0 0 30px rgba(72, 187, 120, 0.5)';
        
        setTimeout(() => {
            container.style.boxShadow = '';
        }, 300);
    }

    addRarityClass(element, rarity) {
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        rarities.forEach(r => element.classList.remove(r));
        if (rarity) {
            element.classList.add(rarity);
        }
    }

    getItemIcon(item) {
        // Map item types to icons
        const iconMap = {
            weapon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M6.92 5L5 6.92l2.83 2.83L6.92 5zm4.24 4.24L5 15.4l3.54 3.54 6.16-6.16-3.54-3.54z'/%3E%3C/svg%3E",
            armor: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E",
            helmet: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8 2 6 4 6 8v4c0 2 1 3 2 4h8c1-1 2-2 2-4V8c0-4-2-6-6-6z'/%3E%3C/svg%3E",
            shield: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z'/%3E%3C/svg%3E",
            ring: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ccircle cx='12' cy='12' r='6'/%3E%3C/svg%3E",
            amulet: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8'/%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3C/svg%3E",
            boots: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M4 18h16v2H4v-2zm0-4h16v2H4v-2zm0-4h16v2H4v-2z'/%3E%3C/svg%3E",
            gloves: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M8 2v6h8V2H8zm0 8v6c0 2 2 4 4 4s4-2 4-4v-6H8z'/%3E%3C/svg%3E"
        };
        
        return iconMap[item.type] || iconMap.weapon;
    }

    addTooltip(element, item) {
        let tooltip = null;
        
        const showTooltip = (e) => {
            if (tooltip) return;
            
            tooltip = document.createElement('div');
            tooltip.className = 'modern-item-tooltip';
            tooltip.innerHTML = `
                <div class="modern-tooltip-title" style="color: ${this.getRarityColor(item.rarity)}">${item.name}</div>
                <div class="modern-tooltip-stats">${item.damage ? `+${item.damage} Damage` : `+${item.defense || 0} Defense`}</div>
                ${item.description ? `<div class="modern-tooltip-description">${item.description}</div>` : ''}
            `;
            
            document.body.appendChild(tooltip);
            
            // Position tooltip
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let left = rect.right + 15;
            let top = rect.top;
            
            // Keep tooltip on screen
            if (left + tooltipRect.width > window.innerWidth) {
                left = rect.left - tooltipRect.width - 15;
            }
            if (top + tooltipRect.height > window.innerHeight) {
                top = window.innerHeight - tooltipRect.height - 15;
            }
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        };
        
        const hideTooltip = () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        };
        
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        
        // Store reference for cleanup
        element._modernTooltipHandlers = { showTooltip, hideTooltip };
    }

    removeTooltip(element) {
        if (element._modernTooltipHandlers) {
            element.removeEventListener('mouseenter', element._modernTooltipHandlers.showTooltip);
            element.removeEventListener('mouseleave', element._modernTooltipHandlers.hideTooltip);
            delete element._modernTooltipHandlers;
        }
    }

    getRarityColor(rarity) {
        const colors = {
            common: '#9ca3af',
            uncommon: '#10b981',
            rare: '#3b82f6',
            epic: '#8b5cf6',
            legendary: '#f59e0b'
        };
        return colors[rarity] || colors.common;
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
        
        // Show sort animation
        const grid = document.getElementById('modern-inventory-items-grid');
        grid.style.animation = 'none';
        grid.offsetHeight; // Trigger reflow
        grid.style.animation = 'itemAdded 0.4s ease-out';
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
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            // Initialize the modern inventory system
            if (!window.modernInventorySystem) {
                window.modernInventorySystem = new ModernInventorySystem(socket);
                console.log('✅ Modern Inventory System initialized with existing socket');
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
            console.log('✅ Modern Inventory System manually initialized');
        }
        return window.modernInventorySystem;
    };
})();