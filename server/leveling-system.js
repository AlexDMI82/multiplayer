const { PlayerLevel, Stats } = require('../models');

// Constants for the leveling system
const XP_FOR_WIN = 250;
const XP_FOR_LOSS = 100;
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

        const xpGained = result === 'win' ? XP_FOR_WIN : XP_FOR_LOSS;
        playerLevel.totalXP += xpGained;

        const originalLevel = playerLevel.level;
        let xpForNext = this.getTotalXPForLevel(playerLevel.level + 1);
        
        while (playerLevel.totalXP >= xpForNext) {
            playerLevel.level++;
            xpForNext = this.getTotalXPForLevel(playerLevel.level + 1);
        }

        const leveledUp = playerLevel.level > originalLevel;
        if (leveledUp) {
            const levelsGained = playerLevel.level - originalLevel;
            const pointsAwarded = levelsGained * STAT_POINTS_PER_LEVEL;
            await Stats.updateOne({ userId }, { $inc: { availablePoints: pointsAwarded } });
            console.log(`Player ${userId} leveled up to ${playerLevel.level}! Awarded ${pointsAwarded} stat points.`);
        }
        
        await playerLevel.save();

        return { leveledUp, updatedLevel: playerLevel };
    }
}

module.exports = new LevelingSystem();