const Bot = require('../models/bot');
const { Stats, PlayerLevel, Inventory } = require('../models');

class BotManager {
  // --- FIXED: Accept gameUtils in the constructor ---
  constructor(io, combatSystem, gameUtils) {
    this.io = io;
    this.combatSystem = combatSystem;
    this.gameUtils = gameUtils; // Store gameUtils instance
    this.activeBots = new Map(); // socketId -> bot data
    this.botGames = new Map(); // gameId -> bot game data
    this.botMoveTimers = new Map(); // gameId -> timeout
  }

  // Initialize bots and add them to the game
  async initializeBots() {
    try {
      const bots = await Bot.find({ isActive: true });
      console.log(`Loading ${bots.length} bots into the game...`);
      
      for (const bot of bots) {
        await this.addBotToGame(bot);
      }
      
      console.log(`${this.activeBots.size} bots are now online`);
    } catch (error) {
      console.error('Error initializing bots:', error);
    }
  }

  // Add a single bot to the game
  async addBotToGame(bot) {
    const botSocketId = `bot_${bot._id}`;
    
    // Get or create bot stats
    let stats = await Stats.findOne({ userId: bot._id });
    if (!stats) {
      // Calculate stats based on character class and level
      const characterBonuses = this.getCharacterBonuses(bot.characterClass);
      stats = await Stats.create({
        userId: bot._id,
        strength: bot.baseStats.strength + characterBonuses.strength + (bot.level - 1),
        agility: bot.baseStats.agility + characterBonuses.agility + (bot.level - 1),
        intuition: bot.baseStats.intuition + characterBonuses.intuition + (bot.level - 1),
        endurance: bot.baseStats.endurance + characterBonuses.endurance + (bot.level - 1),
        specialAbility: characterBonuses.specialAbility,
        totalWins: bot.wins,
        totalLosses: bot.losses
      });
    }

    // Get or create inventory
    let inventory = await Inventory.findOne({ userId: bot._id });
    if (!inventory) {
      inventory = await Inventory.create({
        userId: bot._id,
        gold: 100 * bot.level,
        equipped: bot.equipment || {}
      });
    }

    // Get or create player level
    let playerLevel = await PlayerLevel.findOne({ userId: bot._id });
    if (!playerLevel) {
      playerLevel = await PlayerLevel.create({
        userId: bot._id,
        level: bot.level,
        totalXP: bot.level * 1000 // Approximate XP for the level
      });
    }

    // Create bot player data similar to real players
    const botPlayerData = {
      socketId: botSocketId,
      userId: bot._id.toString(),
      username: bot.username,
      avatar: bot.avatar,
      characterClass: bot.characterClass,
      stats: stats,
      inventory: inventory,
      level: bot.level,
      playerLevel: playerLevel,
      isBot: true,
      personality: bot.personality,
      difficulty: bot.difficulty
    };

    this.activeBots.set(botSocketId, botPlayerData);
    
    // Emit bot as online player
    this.emitBotOnline(botPlayerData);
  }

  // Emit bot as online player to all clients
  emitBotOnline(botData) {
    // Get all connected players including bots
    const allPlayers = this.getAllPlayersIncludingBots();
    this.io.emit('updatePlayerList', allPlayers);
  }

  // Get all players including bots
  getAllPlayersIncludingBots() {
    const players = [];
    
    // Add real players from the main server's connectedPlayers map
    if (global.connectedPlayers) {
      players.push(...Array.from(global.connectedPlayers.values()));
    }
    
    // Add bots
    players.push(...Array.from(this.activeBots.values()));
    
    return players;
  }

  // Handle challenge to bot
  async handleBotChallenge(challengerId, botSocketId, challengeData) {
    const bot = this.activeBots.get(botSocketId);
    if (!bot) {
      console.error(`❌ Bot not found: ${botSocketId}`);
      return;
    }

    // Reduce bot thinking time for faster response
    const baseThinkTime = 500; // 0.5 seconds minimum
    const randomDelay = Math.random() * 1000; // 0-1 second additional
    const thinkTime = baseThinkTime + randomDelay;
    
    console.log(`🤖 Bot ${bot.username} will accept challenge in ${thinkTime}ms`);
    
    setTimeout(() => {
      // Bot always accepts the challenge
      console.log(`🤖 Bot ${bot.username} accepted challenge from player`);
      this.acceptBotChallenge(challengerId, botSocketId, challengeData);
    }, thinkTime);
  }

  // Bot accepts challenge
  async acceptBotChallenge(challengerId, botSocketId, challengeData) {
    const bot = this.activeBots.get(botSocketId);
    if (!bot) {
      console.error(`❌ Bot not found for challenge: ${botSocketId}`);
      return;
    }

    const gameId = `game_${Date.now()}_${challengerId.substring(0, 5)}_${botSocketId.substring(0, 5)}`;
    
    // Get bot stats and inventory
    const botStats = await Stats.findOne({ userId: bot.userId });
    const botInventory = await Inventory.findOne({ userId: bot.userId });
    const botPlayerLevel = await PlayerLevel.findOne({ userId: bot.userId });

    // Send game start data to challenger
    this.io.to(challengerId).emit('challengeAccepted', {
      gameId,
      opponent: {
        id: botSocketId,
        userId: bot.userId,
        username: bot.username,
        avatar: bot.avatar,
        characterClass: bot.characterClass,
        stats: botStats ? {
          strength: botStats.strength,
          agility: botStats.agility,
          intuition: botStats.intuition,
          endurance: botStats.endurance
        } : { strength: 10, agility: 10, intuition: 10, endurance: 10 },
        equipment: botInventory ? botInventory.equipped : {},
        level: botPlayerLevel ? botPlayerLevel.level : bot.level
      }
    });
    
    // Store bot game data
    this.botGames.set(gameId, {
      botSocketId,
      opponentSocketId: challengerId,
      bot: bot
    });

    console.log(`✅ Bot challenge accepted. Game ID: ${gameId}`);
  }

  // Handle bot joining game
  async handleBotJoinGame(gameId, game) {
    const botGame = this.botGames.get(gameId);
    if (!botGame) {
      console.log(`No bot game data found for ${gameId}`);
      return;
    }
    
    const bot = botGame.bot;
    const stats = await Stats.findOne({ userId: bot.userId });
    const inventory = await Inventory.findOne({ userId: bot.userId });
    const playerLevel = await PlayerLevel.findOne({ userId: bot.userId });
    
    // Calculate bot health
    const baseHealth = 200;
    const endurance = stats ? stats.endurance : 10;
    const enduranceBonus = (endurance - 10) * 10;
    const totalMaxHealth = baseHealth + enduranceBonus;
    
    // Get character bonuses
    const characterBonuses = this.getCharacterBonuses(bot.characterClass);
    
    // Add bot to game as player
    game.players[botGame.botSocketId] = {
      socketId: botGame.botSocketId,
      userId: bot.userId,
      username: bot.username,
      avatar: bot.avatar,
      characterClass: bot.characterClass,
      health: totalMaxHealth,
      maxHealth: totalMaxHealth,
      stats: stats ? {
        strength: stats.strength,
        agility: stats.agility,
        intuition: stats.intuition,
        endurance: stats.endurance
      } : { strength: 10, agility: 10, intuition: 10, endurance: 10 },
      specialAbility: characterBonuses.specialAbility,
      equipment: inventory ? inventory.equipped : {},
      damageBonus: stats ? (stats.strength - 10) * 2 : 0,
      evasionChance: stats ? stats.agility - 10 : 0,
      criticalChance: stats ? stats.intuition - 10 : 0,
      enemyEvasionReduction: stats ? (stats.intuition - 10) * 0.5 : 0,
      level: playerLevel || { level: bot.level, totalXP: bot.level * 1000 },
      ready: true,
      isBot: true
    };

    console.log(`🤖 Bot ${bot.username} joined game ${gameId}`);
  }

  // --- FIXED: generateBotMove now calls gameUtils.processRound ---
  generateBotMove(gameId, game, roundNumber) {
    const botGame = this.botGames.get(gameId);
    if (!botGame) {
      console.log(`No bot game found for ${gameId}`);
      return;
    }
    
    const bot = botGame.bot;
    const botSocketId = botGame.botSocketId;
    const opponentSocketId = botGame.opponentSocketId;
    
    if (this.botMoveTimers.has(gameId)) {
      clearTimeout(this.botMoveTimers.get(gameId));
    }
    
    let baseMoveDelay;
    switch (bot.difficulty) {
        case 'easy': baseMoveDelay = 1000; break;
        case 'medium': baseMoveDelay = 800; break;
        case 'hard': baseMoveDelay = 600; break;
        case 'expert': baseMoveDelay = 400; break;
        default: baseMoveDelay = 1000;
    }

    const moveDelay = baseMoveDelay + Math.random() * 1000;
    console.log(`🤖 Bot ${bot.username} (${bot.difficulty}) will make move in ${moveDelay}ms`);
        
    const timer = setTimeout(() => {
      const move = this.calculateBotMove(bot, game, botSocketId, opponentSocketId);
      
      console.log(`🤖 Bot ${bot.username} making move: attack=${move.attackArea}, block=${move.blockArea}`);
      
      game.moves[botSocketId] = {
        attackArea: move.attackArea,
        blockArea: move.blockArea,
        timestamp: Date.now(),
        auto: false
      };
      
      this.io.to(opponentSocketId).emit('opponentMadeMove', {
        playerId: botSocketId,
        playerName: bot.username
      });
      
      const playerIds = Object.keys(game.players);
      const moveIds = Object.keys(game.moves);
      
      if (moveIds.length >= playerIds.length) {
        console.log(`🎯 All moves received for game ${gameId} (including bot), processing round`);
        
        if (game.turnTimer) {
          clearTimeout(game.turnTimer);
          game.turnTimer = null;
        }
        
        this.io.to(gameId).emit('allMovesMade', { message: 'Processing round...' });
        
        // --- CRITICAL FIX ---
        // Call the processRound function from gameUtils to continue the game
        setTimeout(() => {
            this.gameUtils.processRound(gameId);
        }, 1000);
        // --- END FIX ---
      }
      
      this.botMoveTimers.delete(gameId);
    }, moveDelay);
    
    this.botMoveTimers.set(gameId, timer);
  }

  // Calculate bot move based on difficulty and personality
  calculateBotMove(bot, game, botSocketId, opponentSocketId) {
    const areas = ['head', 'body', 'legs'];
    let attackArea, blockArea;
    
    // Get last opponent move if available
    const lastOpponentMove = this.getLastOpponentMove(game, opponentSocketId);
    
    switch (bot.difficulty) {
      case 'easy':
        // Random moves
        attackArea = areas[Math.floor(Math.random() * areas.length)];
        blockArea = areas[Math.floor(Math.random() * areas.length)];
        break;
        
      case 'medium':
        // Some pattern recognition
        if (lastOpponentMove && Math.random() < 0.5) {
          // 50% chance to block where opponent last attacked
          blockArea = lastOpponentMove.attackArea;
        } else {
          blockArea = areas[Math.floor(Math.random() * areas.length)];
        }
        attackArea = areas[Math.floor(Math.random() * areas.length)];
        break;
        
      case 'hard':
        // Better pattern recognition and strategy
        if (lastOpponentMove && Math.random() < 0.7) {
          // 70% chance to block intelligently
          blockArea = this.predictNextAttack(lastOpponentMove);
        } else {
          blockArea = areas[Math.floor(Math.random() * areas.length)];
        }
        // Attack different area than blocking
        do {
          attackArea = areas[Math.floor(Math.random() * areas.length)];
        } while (attackArea === blockArea && Math.random() < 0.7);
        break;
        
      case 'expert':
        // Advanced AI with pattern memory
        blockArea = this.advancedPredict(game, opponentSocketId);
        attackArea = this.calculateOptimalAttack(game, opponentSocketId, blockArea);
        break;
        
      default:
        attackArea = areas[Math.floor(Math.random() * areas.length)];
        blockArea = areas[Math.floor(Math.random() * areas.length)];
    }
    
    // Apply personality modifiers
    if (Math.random() > bot.personality.predictability) {
      // Unpredictable move
      if (Math.random() < 0.5) {
        attackArea = areas[Math.floor(Math.random() * areas.length)];
      } else {
        blockArea = areas[Math.floor(Math.random() * areas.length)];
      }
    }
    
    return { attackArea, blockArea };
  }

  // Helper methods for bot AI
  getLastOpponentMove(game, opponentSocketId) {
    // Implementation to get last opponent move from game history
    return null; // Simplified for now
  }

  predictNextAttack(lastMove) {
    // Simple prediction logic
    const areas = ['head', 'body', 'legs'];
    if (lastMove.attackArea === 'head') return 'body';
    if (lastMove.attackArea === 'body') return 'legs';
    return 'head';
  }

  advancedPredict(game, opponentSocketId) {
    // Advanced prediction logic
    const areas = ['head', 'body', 'legs'];
    return areas[Math.floor(Math.random() * areas.length)];
  }

  calculateOptimalAttack(game, opponentSocketId, blockArea) {
    // Calculate optimal attack area
    const areas = ['head', 'body', 'legs'];
    const nonBlockedAreas = areas.filter(area => area !== blockArea);
    return nonBlockedAreas[Math.floor(Math.random() * nonBlockedAreas.length)];
  }

  // Get character bonuses (same as main game)
  getCharacterBonuses(characterClass) {
    switch(characterClass) {
      case 'shadowsteel':
        return { agility: 7, strength: 3, intuition: 0, endurance: 0, specialAbility: 'evade' };
      case 'ironbound':
        return { agility: 0, strength: 5, intuition: 0, endurance: 5, specialAbility: 'ignoreBlock' };
      case 'flameheart':
        return { agility: 0, strength: 3, intuition: 7, endurance: 0, specialAbility: 'criticalHit' };
      case 'venomfang':
        return { agility: 5, strength: 5, intuition: 0, endurance: 0, specialAbility: 'poison' };
      default:
        return { agility: 0, strength: 0, intuition: 0, endurance: 0, specialAbility: null };
    }
  }

  // Clean up bot game
  cleanupBotGame(gameId) {
    console.log(`🧹 Cleaning up bot game: ${gameId}`);
    this.botGames.delete(gameId);
    if (this.botMoveTimers.has(gameId)) {
      clearTimeout(this.botMoveTimers.get(gameId));
      this.botMoveTimers.delete(gameId);
    }
  }
}

module.exports = BotManager;