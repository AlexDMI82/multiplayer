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
    
  
     const currentStrength = stats?.strength || 10;
    const currentAgility = stats?.agility || 10;
    const currentIntuition = stats?.intuition || 10;
    const currentEndurance = stats?.endurance || 10;

    let itemBonuses = {
      health: 0,
      damage: 0,
      criticalChance: 0,
      evasionChance: 0
    };

    if (inventory && inventory.equipped) {
      for (const item of Object.values(inventory.equipped)) {
        if (item && item.bonuses) {
          itemBonuses.health += item.bonuses.health || 0;
          itemBonuses.damage += item.bonuses.damage || 0;
          itemBonuses.criticalChance += item.bonuses.criticalChance || 0;
          itemBonuses.evasionChance += item.bonuses.evasionChance || 0;
        }
      }
    }

    const baseHealth = 200;
    const enduranceBonus = (currentEndurance > 10) ? (currentEndurance - 10) * 10 : 0;
    const maxHealth = baseHealth + enduranceBonus + itemBonuses.health;


    return {
      socketId: socket.id,
      userId: socket.user._id.toString(),
      username: socket.user.username,
      avatar: socket.user.avatar,
      characterClass: socket.user.characterClass || 'unselected',
      health: maxHealth,     // Start with full health
      maxHealth: maxHealth,  // Set the calculated max health
      
      // Apply character bonuses to base stats
      // Do NOT add characterBonuses here, as they are already included in the 'stats' object.
       stats: {
        strength: currentStrength,
        agility: currentAgility,
        intuition: currentIntuition,
        endurance: currentEndurance,
      },
      
      // Combat properties now include item bonuses
      damageBonus: ((currentStrength - 10) * 2) + itemBonuses.damage,
      criticalChance: (currentIntuition - 10) + itemBonuses.criticalChance,
      evasionChance: (currentAgility - 10) + itemBonuses.evasionChance,
      enemyEvasionReduction: (currentIntuition - 10) * 0.5,
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
        console.log(`🏁 Game ${gameId} ended. Winner: ${result.winner}, Draw: ${result.isDraw}`);
        setTimeout(() => {
          // --- FIX START: Pass the entire result object to endGame ---
          this.endGame(gameId, result);
          // --- FIX END ---
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

  async endGame(gameId, result) {
    const game = this.activeGames.get(gameId);
    if (!game) {
      console.error(`❌ Cannot end game: Game ${gameId} not found`);
      return;
    }
    
    console.log(`🏁 Ending game ${gameId}, result:`, result);
    
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    // Define all variables at the top level of the function scope
    let eventPayload = {}; 
    const winnerId = result.winner;
    const loserId = result.loser;

    if (result.isDraw) {
        // --- DRAW LOGIC ---
        const drawRewards = { xp: 100, gold: 0 };
        console.log(`⚖️ Game ${gameId} is a draw. Awarding reduced XP to both players.`);
        
        for (const playerId of Object.keys(game.players)) {
            const player = game.players[playerId];
            if (player && !player.isBot) {
                try {
                    await this.levelingSystem.processGameResult(player.userId, 'loss');
                    await this.sendProfileUpdate(player.userId);
                } catch (error) {
                    console.error(`Error processing draw result for ${player.username}:`, error);
                }
            }
        }
        
        eventPayload = {
            isDraw: true,
            reason: 'draw',
            rewards: drawRewards
        };

    } else {
        // --- WIN/LOSS LOGIC ---
        const winRewards = { xp: 250, gold: 50 };
        const lossRewards = { xp: 100, gold: 0 };
        
        // Define names safely, defaulting if a player isn't found
        const winnerName = game.players[winnerId]?.username || 'A Fighter';
        const loserName = game.players[loserId]?.username || 'A Fighter';

        // Process winner (if not a bot)
        if (winnerId && game.players[winnerId] && !game.players[winnerId].isBot) {
            try {
                await this.levelingSystem.processGameResult(game.players[winnerId].userId, 'win');
                await this.sendProfileUpdate(game.players[winnerId].userId);
            } catch (error) {
                console.error('Error processing winner stats:', error);
            }
        }
        
        // Process loser (if not a bot)
        if (loserId && game.players[loserId] && !game.players[loserId].isBot) {
            try {
                await this.levelingSystem.processGameResult(game.players[loserId].userId, 'loss');
                await this.sendProfileUpdate(game.players[loserId].userId);
            } catch (error) {
                console.error('Error processing loser stats:', error);
            }
        }

        // Create the single payload for all players
        eventPayload = {
            winner: winnerId,
            winnerName: winnerName,
            loser: loserId,
            loserName: loserName,
            isDraw: false,
            reason: 'defeat',
            // Send the correct rewards based on who is receiving the event
            // The client will determine which set of rewards to use
            rewards: {
                win: winRewards,
                loss: lossRewards
            }
        };
    }

    // Emit one single gameOver event to everyone in the room
    this.io.to(gameId).emit('gameOver', eventPayload);

    console.log(`✅ Game ${gameId} concluded. Event sent to clients.`);
    
    // Clean up the game from active memory
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