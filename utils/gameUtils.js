// utils/gameUtils.js
const { Stats, Inventory, PlayerLevel } = require('../models');

class GameUtils {
  constructor(io, combatSystem, activeGames, levelingSystem, userSockets) {
    this.io = io;
    this.combatSystem = combatSystem;
    this.activeGames = activeGames;
    this.levelingSystem = levelingSystem;
    this.userSockets = userSockets;
  }

  getCharacterBonuses(characterClass) {
    console.log(`🔍 Getting bonuses for character class: ${characterClass}`);
    
    const bonuses = {
      'shadowsteel': { agility: 7, strength: 3, intuition: 0, endurance: 0, specialAbility: 'evade' },
      'ironbound': { agility: 0, strength: 5, intuition: 0, endurance: 5, specialAbility: 'ignoreBlock' },
      'flameheart': { agility: 0, strength: 3, intuition: 7, endurance: 0, specialAbility: 'criticalHit' },
      'venomfang': { agility: 5, strength: 5, intuition: 0, endurance: 0, specialAbility: 'poison' },
      'unselected': { agility: 0, strength: 0, intuition: 0, endurance: 0, specialAbility: null }
    };
    
    const result = bonuses[characterClass] || bonuses['unselected'];
    console.log(`✅ Character bonuses for ${characterClass}:`, result);
    return result;
  }

  // --- FIXED: Added maxHealth calculation ---
  async createPlayerGameData(socket, stats, inventory, playerLevel) {
    const characterBonuses = this.getCharacterBonuses(socket.user.characterClass || 'unselected');
    
    // Calculate max health based on endurance
    const baseHealth = 100; // Base health for all players
    const currentEndurance = (stats?.endurance || 10) + characterBonuses.endurance;
    const enduranceBonus = (currentEndurance - 10) * 10; // +10 HP per point of endurance over 10
    const maxHealth = baseHealth + enduranceBonus;

    return {
      socketId: socket.id,
      userId: socket.user._id.toString(),
      username: socket.user.username,
      avatar: socket.user.avatar,
      characterClass: socket.user.characterClass || 'unselected',
      health: maxHealth,     // Start with full health
      maxHealth: maxHealth,  // Set the calculated max health
      
      // Apply character bonuses to base stats
      stats: {
        strength: (stats?.strength || 10) + characterBonuses.strength,
        agility: (stats?.agility || 10) + characterBonuses.agility,
        intuition: (stats?.intuition || 10) + characterBonuses.intuition,
        endurance: currentEndurance,
      },
      
      // Combat calculation properties
      damageBonus: ((stats?.strength || 10) + characterBonuses.strength - 10) * 2,
      criticalChance: (stats?.intuition || 10) + characterBonuses.intuition - 10,
      evasionChance: (stats?.agility || 10) + characterBonuses.agility - 10,
      enemyEvasionReduction: ((stats?.intuition || 10) + characterBonuses.intuition - 10) * 0.5,
      specialAbility: characterBonuses.specialAbility,
      
      equipment: inventory?.equipped || {},
      level: playerLevel || { level: 1, totalXP: 0 },
      
      // Game state
      ready: false,
      move: null
    };
  }

  // ... (rest of the file remains the same)
  startRound(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) {
      console.error(`❌ Cannot start round: Game ${gameId} not found`);
      return;
    }

    game.currentRound = (game.currentRound || 0) + 1;
    game.moves = {}; // Clear previous moves
    
    console.log(`🎯 Starting round ${game.currentRound} for game ${gameId}`);
    
    // Send round started event
    this.io.to(gameId).emit('roundStarted', {
      round: game.currentRound,
      turnTime: game.turnTime || 30,
      gameState: {
        ...game,
        players: game.players
      }
    });

    // Set turn timer
    game.turnTimer = setTimeout(() => {
      this.handleTurnTimeout(gameId);
    }, (game.turnTime || 30) * 1000);
  }

  handleTurnTimeout(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) {
      console.error(`❌ Cannot handle timeout: Game ${gameId} not found`);
      return;
    }

    console.log(`⏰ Turn timeout for game ${gameId}`);

    const playerIds = Object.keys(game.players);
    
    // Add auto moves for players who didn't move
    playerIds.forEach(playerId => {
      if (!game.moves[playerId]) {
        game.moves[playerId] = {
          attackArea: null,
          blockArea: null,
          auto: true,
          timestamp: Date.now()
        };
        
        // Notify that player skipped turn
        this.io.to(gameId).emit('playerSkippedTurn', {
          playerId: playerId,
          playerName: game.players[playerId].username
        });
      }
    });

    // Process the round
    setTimeout(() => {
      this.processRound(gameId);
    }, 1000);
  }

  processRound(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) {
      console.error(`❌ Cannot process round: Game ${gameId} not found`);
      return;
    }

    console.log(`⚔️ Processing round ${game.currentRound} for game ${gameId}`);

    try {
      // Use the combat system to process the round
      const result = this.combatSystem.processRound(game.players, game.moves);
      
      console.log(`Combat result:`, result);

      // Send round results to all players
      this.io.to(gameId).emit('roundResult', {
        round: game.currentRound,
        moves: game.moves,
        damageDealt: result.damageDealt,
        combatLog: result.combatLog,
        gameState: {
          ...game,
          players: game.players
        }
      });

      // Check if game is over
      if (result.gameOver) {
        console.log(`🏁 Game ${gameId} ended. Winner: ${result.winner}`);
        setTimeout(() => {
          this.endGame(gameId, result.winner);
        }, 3000);
      } else {
        // Start next round after a delay
        setTimeout(() => {
          this.startRound(gameId);
        }, 5000);
      }

    } catch (error) {
      console.error('Error processing round:', error);
      this.io.to(gameId).emit('gameError', { message: 'Error processing round' });
    }
  }

  async endGame(gameId, winnerId) {
    const game = this.activeGames.get(gameId);
    if (!game) {
      console.error(`❌ Cannot end game: Game ${gameId} not found`);
      return;
    }
    
    console.log(`🏁 Ending game ${gameId}, winner: ${winnerId}`);
    
    // Clear the turn timer
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }
    
    const loserId = Object.keys(game.players).find(id => id !== winnerId);
    let winnerName = 'Unknown';
    let loserName = 'Unknown';

    // Process game results for real players (not bots)
    if (winnerId && game.players[winnerId] && !winnerId.startsWith('bot_')) {
      const winner = game.players[winnerId];
      winnerName = winner.username;
      
      try {
        if (this.levelingSystem && typeof this.levelingSystem.processGameResult === 'function') {
          await this.levelingSystem.processGameResult(winner.userId, 'win');
        }
        await this.sendProfileUpdate(winner.userId);
      } catch (error) {
        console.error('Error processing winner stats:', error);
      }
    }
    
    if (loserId && game.players[loserId] && !loserId.startsWith('bot_')) {
      const loser = game.players[loserId];
      loserName = loser.username;
      
      try {
        if (this.levelingSystem && typeof this.levelingSystem.processGameResult === 'function') {
          await this.levelingSystem.processGameResult(loser.userId, 'loss');
        }
        await this.sendProfileUpdate(loser.userId);
      } catch (error) {
        console.error('Error processing loser stats:', error);
      }
    }

    // Send game over event to all players in the game
    this.io.to(gameId).emit('gameOver', {
      winner: winnerId,
      winnerName: winnerName,
      loser: loserId,
      loserName: loserName,
      reason: 'defeat'
    });
    
    console.log(`✅ Game ${gameId} ended: ${winnerName} defeated ${loserName}`);
    
    // Clean up the game
    this.activeGames.delete(gameId);
  }

  async sendProfileUpdate(userId) {
    try {
      const { User } = require('../models');
      const user = await User.findById(userId);
      const stats = await Stats.findOne({ userId });
      const inventory = await Inventory.findOne({ userId });
      const playerLevel = await PlayerLevel.findOne({ userId });

      if (!user || !stats || !inventory || !playerLevel) {
        console.error(`Could not find all data for user ${userId}`);
        return;
      }

      const fullProfileData = {
        user: { 
          id: user._id, 
          username: user.username, 
          email: user.email, 
          avatar: user.avatar, 
          characterClass: user.characterClass 
        },
        stats,
        inventory,
        playerLevel
      };
      
      const sockets = this.userSockets.get(userId.toString());
      if (sockets && sockets.size > 0) {
        sockets.forEach(socketId => {
          this.io.to(socketId).emit('profileDataUpdate', fullProfileData);
        });
        console.log(`Sent profile update to ${user.username} on ${sockets.size} connections.`);
      }
    } catch(error) {
      console.error(`Error sending profile update to user ${userId}:`, error);
    }
  }
}

module.exports = GameUtils;