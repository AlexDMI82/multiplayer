// stats-manager.js - Handles player stats and bonuses

class StatsManager {
    constructor() {
        this.stats = {
            strength: 10,
            agility: 10,
            intuition: 10,
            endurance: 10,
            availablePoints: 0
        };
        this.characterBonuses = {
            strength: 0,
            agility: 0,
            intuition: 0,
            endurance: 0,
            specialAbility: null
        };
        this.baseStats = {
            strength: 10,
            agility: 10,
            intuition: 10,
            endurance: 10
        };
    }
    
    init() {
        this.loadStatsFromLocalStorage();
        this.setupEventListeners();
        this.updateStatsUI();
        
        // Initialize Socket.io event listeners
        if (socket && socket.connected) {
            socket.on('statsUpdate', (stats) => {
                this.loadStatsFromServer(stats);
            });
        }
    }
    
    loadStatsFromLocalStorage() {
        // Load character bonuses if available
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const userData = JSON.parse(userStr);
                
                if (userData.characterClass) {
                    this.characterBonuses = this.getCharacterBonuses(userData.characterClass);
                    console.log('Loaded character bonuses:', this.characterBonuses);
                }
            } catch (e) {
                console.error('Error parsing user data from localStorage:', e);
            }
        }
    }
    
    loadStatsFromServer(stats) {
        if (!stats) return;
        
        // Store the base stats without character bonuses
        this.baseStats = {
            strength: stats.strength - this.characterBonuses.strength,
            agility: stats.agility - this.characterBonuses.agility,
            intuition: stats.intuition - this.characterBonuses.intuition,
            endurance: stats.endurance - this.characterBonuses.endurance
        };
        
        // Store the full stats with bonuses
        this.stats = {
            strength: stats.strength,
            agility: stats.agility,
            intuition: stats.intuition,
            endurance: stats.endurance,
            availablePoints: stats.availablePoints || 0
        };
        
        // Update UI with new stats
        this.updateStatsUI();
    }
    
    setupEventListeners() {
        // Add event listeners for stat increase buttons
        document.querySelectorAll('.stat-increase').forEach(button => {
            button.addEventListener('click', () => {
                const statType = button.getAttribute('data-stat');
                this.increaseStat(statType);
            });
        });
    }
    
    increaseStat(statType) {
        if (this.stats.availablePoints <= 0) return;
        
        // Increase base stat (not the character bonus)
        this.baseStats[statType]++;
        
        // Calculate new total stat with bonus
        this.stats[statType] = this.baseStats[statType] + this.characterBonuses[statType];
        
        this.stats.availablePoints--;
        
        // Send updated stats to server
        this.saveStatsToServer();
        
        // Update UI
        this.updateStatsUI();
    }
    
    saveStatsToServer() {
        if (socket && socket.connected) {
            socket.emit('updateStats', {
                strength: this.baseStats.strength,
                agility: this.baseStats.agility,
                intuition: this.baseStats.intuition,
                endurance: this.baseStats.endurance
            });
        }
    }
    
    updateStatsUI() {
        // Update stat values in UI
        document.querySelectorAll('.strength-value').forEach(el => el.textContent = this.stats.strength);
        document.querySelectorAll('.agility-value').forEach(el => el.textContent = this.stats.agility);
        document.querySelectorAll('.intuition-value').forEach(el => el.textContent = this.stats.intuition);
        document.querySelectorAll('.endurance-value').forEach(el => el.textContent = this.stats.endurance);
        
        // Update available points
        const availablePointsElements = document.querySelectorAll('.available-points');
        availablePointsElements.forEach(el => {
            el.textContent = this.stats.availablePoints;
            
            // Hide or show based on available points
            if (this.stats.availablePoints <= 0) {
                el.style.display = 'none';
            } else {
                el.style.display = 'inline';
            }
        });
        
        // Enable/disable increase buttons
        document.querySelectorAll('.stat-increase').forEach(button => {
            button.disabled = this.stats.availablePoints <= 0;
        });
        
        // Update stat bars in the lobby sidebar
        this.updateStatBars();
        
        // Ensure no stats buttons are available during battle
        if (typeof disableStatsButtonsDuringBattle === 'function') {
            disableStatsButtonsDuringBattle();
        }
    }
    
    updateStatBars() {
        const maxStat = 30; // Maximum expected stat value for UI display
        
        // Update stat bars in the lobby sidebar
        const strengthFill = document.querySelector('.strength-fill');
        const agilityFill = document.querySelector('.agility-fill');
        const intuitionFill = document.querySelector('.intuition-fill');
        const enduranceFill = document.querySelector('.endurance-fill');
        
        if (strengthFill) strengthFill.style.width = `${Math.min(100, (this.stats.strength / maxStat) * 100)}%`;
        if (agilityFill) agilityFill.style.width = `${Math.min(100, (this.stats.agility / maxStat) * 100)}%`;
        if (intuitionFill) intuitionFill.style.width = `${Math.min(100, (this.stats.intuition / maxStat) * 100)}%`;
        if (enduranceFill) enduranceFill.style.width = `${Math.min(100, (this.stats.endurance / maxStat) * 100)}%`;
    }
    
    // Get character bonuses based on character class
    getCharacterBonuses(characterClass) {
        switch(characterClass) {
            case 'shadowsteel':
                return {
                    agility: 7,
                    strength: 3,
                    intuition: 0,
                    endurance: 0,
                    specialAbility: 'evade'
                };
            case 'ironbound':
                return {
                    agility: 0,
                    strength: 5,
                    intuition: 0,
                    endurance: 5,
                    specialAbility: 'ignoreBlock'
                };
            case 'flameheart':
                return {
                    agility: 0,
                    strength: 3,
                    intuition: 7,
                    endurance: 0,
                    specialAbility: 'criticalHit'
                };
            case 'venomfang':
                return {
                    agility: 5,
                    strength: 5,
                    intuition: 0,
                    endurance: 0,
                    specialAbility: 'poison'
                };
            default:
                return {
                    agility: 0,
                    strength: 0,
                    intuition: 0,
                    endurance: 0,
                    specialAbility: null
                };
        }
    }
}

// Initialize the StatsManager
window.statsManager = new StatsManager();