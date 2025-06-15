const { PlayerLevel, Stats, Inventory } = require('../models');

// Constants for the leveling system
const XP_FOR_WIN = 250;
const XP_FOR_LOSS = 100;
const GOLD_FOR_WIN = 50;  // 50 gold for a win
const GOLD_FOR_LOSS = 0;   // 0 gold for a loss or draw
const GOLD_PER_LEVEL_UP = 500; // 500 gold upon leveling up
const BASE_XP_TO_LEVEL = 1000;
const XP_INCREASE_PER_LEVEL = 200;
const STAT_POINTS_PER_LEVEL = 5;

class LevelingSystem {
    /**
     * Calculates the total XP required to have reached a specific level from level 1.
     * @param {number} level - The target level.
     * @returns {number} - The total XP threshold for that level.
     */
    getTotalXPForLevel(level) {
        if (level <= 1) return 0;
        let totalXP = 0;
        // Sum the XP needed for each level-up from 1 to the target level
        for (let i = 2; i <= level; i++) {
            totalXP += BASE_XP_TO_LEVEL + (i - 2) * XP_INCREASE_PER_LEVEL;
        }
        return totalXP;
    }

    /**
     * Calculates the amount of XP needed to go from the current level to the next.
     * @param {number} currentLevel - The player's current level.
     * @returns {number} - The XP needed for the next level up.
     */
    getXPForNextLevelUp(currentLevel) {
        // The XP cost for the *next* level-up (e.g., from level 1 to 2, it's 1000)
        return BASE_XP_TO_LEVEL + (currentLevel - 1) * XP_INCREASE_PER_LEVEL;
    }

    /**
     * One-time migration for existing players from a win-based system to an XP-based system.
     * This ensures old players get credit for their past games.
     */
    async migratePlayerToXP(userId) {
        const stats = await Stats.findOne({ userId });
        const playerLevel = await PlayerLevel.findOne({ userId });

        if (stats && playerLevel && playerLevel.totalXP === 0 && (stats.totalWins > 0 || stats.totalLosses > 0)) {
            console.log(`Migrating player ${userId} to XP system...`);
            const estimatedXP = (stats.totalWins * XP_FOR_WIN) + (stats.totalLosses * XP_FOR_LOSS);
            playerLevel.totalXP = estimatedXP;

            // Recalculate level based on migrated XP
            let newLevel = 1;
            while(playerLevel.totalXP >= this.getTotalXPForLevel(newLevel + 1)) {
                newLevel++;
            }
            playerLevel.level = newLevel;
            
            await playerLevel.save();
            console.log(`Player ${userId} migrated to Level ${newLevel} with ${estimatedXP} XP.`);
        }
    }

    /**
     * Processes the result of a game, awards XP, and handles level-ups.
     * @param {string} userId - The ID of the user.
     * @param {'win' | 'loss'} result - The outcome of the game.
     * @returns {Promise<object>} - An object indicating if a level-up occurred.
     */
    async processGameResult(userId, result) {
        let playerLevel = await PlayerLevel.findOne({ userId });
        if (!playerLevel) {
            playerLevel = await PlayerLevel.create({ userId: userId, level: 1, totalXP: 0 });
        }

     
        // 1. Calculate XP and Gold based on the game result
        const xpGained = result === 'win' ? XP_FOR_WIN : XP_FOR_LOSS;
        const goldGainedFromGame = result === 'win' ? GOLD_FOR_WIN : GOLD_FOR_LOSS;

        playerLevel.totalXP += xpGained;
        
        // This will be the total gold to award, starting with game result gold
        let totalGoldAwarded = goldGainedFromGame; 
        
        // 2. Handle Level-Up Logic
        const originalLevel = playerLevel.level;
        let xpForNext = this.getTotalXPForLevel(playerLevel.level + 1);
        
        let levelsGained = 0;
        while (playerLevel.totalXP >= xpForNext) {
            playerLevel.level++;
            levelsGained++;
            xpForNext = this.getTotalXPForLevel(playerLevel.level + 1);
        }

        const leveledUp = levelsGained > 0;
        if (leveledUp) {
            const pointsAwarded = levelsGained * STAT_POINTS_PER_LEVEL;
            const goldFromLevelUp = levelsGained * GOLD_PER_LEVEL_UP;
            
            // Add level-up gold to the total
            totalGoldAwarded += goldFromLevelUp; 

            await Stats.updateOne({ userId }, { $inc: { availablePoints: pointsAwarded } });
            console.log(`✨ Player ${userId} leveled up to ${playerLevel.level}! Awarded ${pointsAwarded} stat points and ${goldFromLevelUp} gold.`);
        }
        
        // 3. Update Inventory with the total combined gold
        if (totalGoldAwarded > 0) {
            await Inventory.updateOne({ userId }, { $inc: { gold: totalGoldAwarded } });
            console.log(`💰 Player ${userId} was awarded a total of ${totalGoldAwarded} gold.`);
        }
        
        await playerLevel.save();

        return { leveledUp, updatedLevel: playerLevel };
    }
}

module.exports = new LevelingSystem();