// updateLobbyStats.js - Helper functions to properly update lobby stats

/**
 * Update all lobby stats based on player data
 * @param {Object} playerData - Player data from server
 */
function updateLobbyStats(playerData) {
    console.log('Updating lobby stats with:', playerData);
    
    // Update win/loss stats
    updateWinLossStats(playerData);
    
    // Update character stats
    updateCharacterStats(playerData);
    
    // Update equipment display
    updateEquippedItemsDisplay(playerData.inventory?.equipped);
}

/**
 * Update win/loss stats in the lobby UI
 * @param {Object} playerData - Player data containing stats
 */
function updateWinLossStats(playerData) {
    // Get win/loss elements
    const winsElement = document.querySelector('.wins-count');
    const lossesElement = document.querySelector('.losses-count');
    const winRateElement = document.querySelector('.winrate-value');
    const rankElement = document.querySelector('.rank');
    const levelIndicator = document.querySelector('.level-indicator');
    
    // Only proceed if we have stats data
    if (!playerData.stats) return;
    
    // Update wins and losses
    const wins = playerData.stats.totalWins || 0;
    const losses = playerData.stats.totalLosses || 0;
    
    if (winsElement) winsElement.textContent = wins;
    if (lossesElement) lossesElement.textContent = losses;
    
    // Calculate and update win rate
    let winRate = 0;
    if (wins + losses > 0) {
        winRate = Math.round((wins / (wins + losses)) * 100);
    }
    
    if (winRateElement) winRateElement.textContent = `${winRate}%`;
    
    // Update rank/level
    const level = playerData.level || 1;
    if (rankElement) rankElement.textContent = `LVL ${level}`;
    if (levelIndicator) levelIndicator.textContent = `LVL ${level}`;
}

/**
 * Update character stats display
 * @param {Object} playerData - Player data containing stats
 */
function updateCharacterStats(playerData) {
    if (!playerData.stats) return;
    
    const stats = playerData.stats;
    
    // Update quick stats values
    updateStatDisplay('strength', stats.strength || 10);
    updateStatDisplay('agility', stats.agility || 10);
    updateStatDisplay('intuition', stats.intuition || 10);
    updateStatDisplay('endurance', stats.endurance || 10);
    
    // Clean up any displaced icons that might appear in stat values
    cleanupDisplacedIcons();
}

/**
 * Update a specific stat display
 * @param {string} statName - Name of the stat (strength, agility, etc)
 * @param {number} value - Value of the stat
 */
function updateStatDisplay(statName, value) {
    // Update quick stat in profile sidebar
    const statValueElement = document.querySelector(`.${statName}-value`);
    const statFillElement = document.querySelector(`.${statName}-fill`);
    
    if (statValueElement) {
        statValueElement.textContent = value;
    }
    
    if (statFillElement) {
        // Calculate fill percentage (assuming max is 20)
        const maxStat = 20;
        const fillPercentage = Math.min(100, (value / maxStat) * 100);
        statFillElement.style.width = `${fillPercentage}%`;
    }
}

/**
 * Update equipped items display
 * @param {Object} equippedItems - Equipped items data
 */
function updateEquippedItemsDisplay(equippedItems) {
    if (!equippedItems) return;
    
    // Get element references
    const weaponNameElement = document.getElementById('equipped-weapon-name');
    const armorNameElement = document.getElementById('equipped-armor-name');
    const shieldNameElement = document.getElementById('equipped-shield-name');
    const helmetNameElement = document.getElementById('equipped-helmet-name');
    
    // Update equipped item names
    if (weaponNameElement) {
        weaponNameElement.textContent = equippedItems.weapon ? equippedItems.weapon.name : 'None';
    }
    
    if (armorNameElement) {
        armorNameElement.textContent = equippedItems.armor ? equippedItems.armor.name : 'None';
    }
    
    if (shieldNameElement) {
        shieldNameElement.textContent = equippedItems.shield ? equippedItems.shield.name : 'None';
    }
    
    if (helmetNameElement) {
        helmetNameElement.textContent = equippedItems.helmet ? equippedItems.helmet.name : 'None';
    }
}

/**
 * Clean up any displaced icons in the stats container
 */
function cleanupDisplacedIcons() {
    // Remove any icons from stat values
    document.querySelectorAll('.stat-value').forEach(element => {
        // Keep only the text content
        const textContent = element.textContent;
        element.innerHTML = textContent;
    });
    
    // Remove any images or icons from the stats container
    document.querySelectorAll('.stats-container img, .stats-container .item-icon').forEach(element => {
        element.remove();
    });
}

// Export functions to global namespace
window.updateLobbyStats = updateLobbyStats;
window.updateWinLossStats = updateWinLossStats;
window.updateCharacterStats = updateCharacterStats;
window.updateEquippedItemsDisplay = updateEquippedItemsDisplay;
window.cleanupDisplacedIcons = cleanupDisplacedIcons;