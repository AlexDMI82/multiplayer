// server.js - Simplified working version
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import models
const { User, Stats, Inventory, PlayerLevel } = require('./models');

// Import existing systems
const levelingSystem = require('./server/leveling-system');
const BotManager = require('./server/botManager');
const CombatSystem = require('./combat-system-server.js');

// Global state
const activeChallenges = new Map();
const userSockets = new Map();
const connectedPlayers = new Map();
const activeGames = new Map();

// Initialize systems
const combatSystem = new CombatSystem();
const botManager = new BotManager(io, combatSystem);

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Utility functions
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

function getCharacterBonuses(characterClass) {
  const bonuses = {
    'shadowsteel': { agility: 7, strength: 3, intuition: 0, endurance: 0, specialAbility: 'evade' },
    'ironbound': { agility: 0, strength: 5, intuition: 0, endurance: 5, specialAbility: 'ignoreBlock' },
    'flameheart': { agility: 0, strength: 3, intuition: 7, endurance: 0, specialAbility: 'criticalHit' },
    'venomfang': { agility: 5, strength: 5, intuition: 0, endurance: 0, specialAbility: 'poison' },
    'unselected': { agility: 0, strength: 0, intuition: 0, endurance: 0, specialAbility: null }
  };
  return bonuses[characterClass] || bonuses['unselected'];
}

// FIXED: Game utility functions that actually work
function startRound(gameId) {
  const game = activeGames.get(gameId);
  if (!game) {
    console.error(`❌ Cannot start round: Game ${gameId} not found`);
    return;
  }

  game.currentRound = (game.currentRound || 0) + 1;
  game.moves = {};
  
  console.log(`🎯 STARTING ROUND ${game.currentRound} for game ${gameId}`);
  
  io.to(gameId).emit('roundStarted', {
    round: game.currentRound,
    turnTime: game.turnTime || 30,
    gameState: { ...game, players: game.players }
  });

  game.turnTimer = setTimeout(() => {
    handleTurnTimeout(gameId);
  }, (game.turnTime || 30) * 1000);
}

function handleTurnTimeout(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  console.log(`⏰ Turn timeout for game ${gameId}`);
  const playerIds = Object.keys(game.players);
  
  playerIds.forEach(playerId => {
    if (!game.moves[playerId]) {
      game.moves[playerId] = {
        attackArea: null,
        blockArea: null,
        auto: true,
        timestamp: Date.now()
      };
    }
  });

  setTimeout(() => processRound(gameId), 1000);
}

function processRound(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  console.log(`⚔️ Processing round ${game.currentRound} for game ${gameId}`);

  try {
    const result = combatSystem.processRound(game.players, game.moves);
    
    io.to(gameId).emit('roundResult', {
      round: game.currentRound,
      moves: game.moves,
      damageDealt: result.damageDealt,
      combatLog: result.combatLog,
      gameState: { ...game, players: game.players }
    });

    if (result.gameOver) {
      console.log(`🏁 Game ${gameId} ended. Winner: ${result.winner}`);
      setTimeout(() => endGame(gameId, result.winner), 3000);
    } else {
      setTimeout(() => startRound(gameId), 5000);
    }
  } catch (error) {
    console.error('Error processing round:', error);
    io.to(gameId).emit('gameError', { message: 'Error processing round' });
  }
}

async function endGame(gameId, winnerId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  console.log(`🏁 Ending game ${gameId}, winner: ${winnerId}`);
  
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
  
  const loserId = Object.keys(game.players).find(id => id !== winnerId);

  if (winnerId && game.players[winnerId] && !winnerId.startsWith('bot_')) {
    const winner = game.players[winnerId];
    if (levelingSystem && typeof levelingSystem.processGameResult === 'function') {
      await levelingSystem.processGameResult(winner.userId, 'win');
    }
  }
  
  if (loserId && game.players[loserId] && !loserId.startsWith('bot_')) {
    const loser = game.players[loserId];
    if (levelingSystem && typeof levelingSystem.processGameResult === 'function') {
      await levelingSystem.processGameResult(loser.userId, 'loss');
    }
  }
  
  io.to(gameId).emit('gameOver', {
    winner: winnerId,
    loser: loserId,
    reason: 'defeat'
  });
  
  activeGames.delete(gameId);
}

async function ensureInventoryExists(userId) {
  try {
    let inventory = await Inventory.findOne({ userId });
    
    if (!inventory) {
      inventory = await Inventory.create({
        userId: userId,
        gold: 1000,
        equipped: {
          weapon: null, armor: null, shield: null, helmet: null,
          boots: null, gloves: null, amulet: null, ring: null
        },
        inventory: []
      });
    }
    return inventory;
  } catch (error) {
    console.error(`❌ Error ensuring inventory exists for user ${userId}:`, error);
    throw error;
  }
}

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(express.static(__dirname)); 
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Authentication middleware (copy your existing authenticate function here)
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      if (req.path.endsWith('.html') || req.path === '/profile' || req.path === '/character-select.html' || req.path === '/shop.html') {
        return res.redirect('/login.html');
      }
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      if (req.path.endsWith('.html') || req.path === '/profile' || req.path === '/character-select.html' || req.path === '/shop.html') {
        return res.redirect('/login.html');
      }
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    if (req.path.endsWith('.html') || req.path === '/profile' || req.path === '/character-select.html' || req.path === '/shop.html') {
      return res.redirect('/login.html');
    }
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// Routes (copy your existing routes here - register, login, etc.)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/character-profile.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'character-profile.html')));
app.get('/profile.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/shop.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'shop.html')));
app.get('/profile', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/character-select.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'character-select.html')));

// API Routes
app.post('/api/register', async (req, res) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  
  try {
    const { username, email, password, avatar: rawAvatar } = req.body;
    
    let finalAvatarPath = rawAvatar;
    if (finalAvatarPath && typeof finalAvatarPath === 'string' && !finalAvatarPath.startsWith('images/')) {
      finalAvatarPath = `images/${finalAvatarPath}`;
    } else if (!finalAvatarPath) {
      finalAvatarPath = 'images/default-avatar.png';
    }
    
    console.log('Registration request received:', { username, email, avatar: finalAvatarPath });
    
    const existingUser = await User.findOne({ $or: [{ username }, { email }] }).session(mongoSession);
    if (existingUser) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      return res.status(400).json({ 
        message: existingUser.username === username 
          ? 'Username already exists' 
          : 'Email already registered' 
      });
    }
    
    console.log('Creating user...');
    const user = new User({ username, email, password, avatar: finalAvatarPath });
    await user.save({ session: mongoSession });
    console.log('User created successfully:', user._id.toString());
    
    console.log('Creating stats, inventory, player level...');
    await Stats.create([{ userId: user._id }], { session: mongoSession });
    await Inventory.create([{ userId: user._id, gold: 1000 }], { session: mongoSession });
    await PlayerLevel.create([{ userId: user._id, level: 1, totalXP: 0 }], { session: mongoSession });
    console.log('Initial documents created successfully.');
    
    await mongoSession.commitTransaction();
    mongoSession.endSession();
    console.log('Transaction committed successfully');
    
    const token = generateToken(user._id);
    console.log('Token generated successfully');
    
    res.cookie('token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });
    
    console.log('Sending successful registration response');
    res.status(201).json({ 
      message: 'Registration successful',
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar,
        characterClass: user.characterClass || null
      },
      token
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    mongoSession.endSession();
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);
    
    const user = await User.findOne({ username });
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    user.lastLogin = Date.now();
    await user.save();
    
    const token = generateToken(user._id);
    console.log('Login successful for user:', username);
    
    res.cookie('token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });
    
    res.json({ 
      message: 'Login successful',
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar,
        characterClass: user.characterClass || null
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.post('/api/select-character', authenticate, async (req, res) => {
  try {
    console.log('Character selection request received:', req.body);
    const { characterClass } = req.body;
    const userId = req.user._id;
    
    const validClasses = ['shadowsteel', 'ironbound', 'flameheart', 'venomfang'];
    if (!validClasses.includes(characterClass)) {
      console.log('Invalid character class:', characterClass);
      return res.status(400).json({ error: 'Invalid character class' });
    }
    
    const characterBonuses = getCharacterBonuses(characterClass);
    
    const user = await User.findByIdAndUpdate(
      userId,
      { characterClass, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!user) {
      console.log('User not found for character selection:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const baseStats = { strength: 10, agility: 10, intuition: 10, endurance: 10 };
    const updatedStatsData = {
      strength: baseStats.strength + characterBonuses.strength,
      agility: baseStats.agility + characterBonuses.agility,
      intuition: baseStats.intuition + characterBonuses.intuition,
      endurance: baseStats.endurance + characterBonuses.endurance,
      specialAbility: characterBonuses.specialAbility
    };
    
    const playerStats = await Stats.findOneAndUpdate(
      { userId },
      { ...updatedStatsData, lastUpdated: Date.now() },
      { upsert: true, new: true }
    );
    
    console.log('Character selected and stats updated for user:', user.username);

    res.json({
      message: 'Character selected successfully',
      user: {
        id: user._id,
        username: user.username,
        characterClass: user.characterClass,
        stats: {
          strength: playerStats.strength,
          agility: playerStats.agility,
          intuition: playerStats.intuition,
          endurance: playerStats.endurance,
          specialAbility: playerStats.specialAbility
        }
      }
    });
  } catch (error) {
    console.error('Error selecting character:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout successful' });
});

app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    let stats = await Stats.findOne({ userId });
    if (!stats) stats = await Stats.create({ userId });
    let inventory = await Inventory.findOne({ userId });
    if (!inventory) inventory = await Inventory.create({ userId, gold: 1000 });
    let playerLevel = await PlayerLevel.findOne({ userId });
    if (!playerLevel) playerLevel = await PlayerLevel.create({ userId, level: 1, totalXP: 0 });
    
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar,
        characterClass: req.user.characterClass,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin
      },
      stats,
      inventory,
      playerLevel
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

app.put('/api/profile', authenticate, async (req, res) => {
  try {
    const { username, email, avatar: rawAvatar } = req.body;
    const userId = req.user._id;

    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (rawAvatar) {
      let finalAvatarPath = rawAvatar;
      if (typeof finalAvatarPath === 'string' && !finalAvatarPath.startsWith('images/')) {
        finalAvatarPath = `images/${finalAvatarPath}`;
      }
      updates.avatar = finalAvatarPath;
    }
    updates.updatedAt = Date.now();

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');

    if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error.code === 11000) {
        return res.status(400).json({ message: 'Username or email already in use.' });
    }
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
});

app.put('/api/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
});

// Socket.IO Authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password'); 

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    return next(new Error('Authentication error: Could not authenticate'));
  }
});

global.connectedPlayers = connectedPlayers;

// FIXED: Socket connection with working game flow
io.on('connection', async (socket) => {
  const user = socket.user;
  const userId = user._id.toString();
  console.log(`Player connected: ${user.username} (Socket ID: ${socket.id})`);

  // Track user sockets
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  // Get player data
  const stats = await Stats.findOne({ userId });
  let inventory = await ensureInventoryExists(user._id);
  const playerLevel = await PlayerLevel.findOne({ userId });

  const playerData = {
    socketId: socket.id,
    userId: user._id.toString(),
    username: user.username,
    avatar: user.avatar,
    characterClass: user.characterClass || 'unselected',
    stats: stats,
    inventory: inventory,
    level: playerLevel ? playerLevel.level : 1,
    playerLevel: playerLevel
  };

  connectedPlayers.set(socket.id, playerData);
  io.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());

  // Send initial profile data
  socket.emit('profileData', {
    user: { 
      id: user._id, 
      username: user.username, 
      email: user.email, 
      avatar: user.avatar, 
      characterClass: user.characterClass 
    },
    stats: stats,
    inventory: inventory,
    playerLevel: playerLevel
  });

  // CHALLENGE HANDLERS
  socket.on('challengePlayer', async (opponentId) => {
    try {
      const opponent = connectedPlayers.get(opponentId);
      if (!opponent) {
        socket.emit('challengeFailed', { message: 'Player not found or offline' });
        return;
      }
      
      const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const challengeData = {
        id: challengeId,
        challengerId: socket.id,
        challengerUserId: socket.user._id.toString(),
        opponentId: opponentId,
        timestamp: Date.now(),
        challenger: {
          socketId: socket.id,
          userId: socket.user._id.toString(),
          username: socket.user.username,
          avatar: socket.user.avatar,
          characterClass: socket.user.characterClass || 'unselected'
        }
      };
      
      activeChallenges.set(challengeId, challengeData);
      
      io.to(opponentId).emit('challengeReceived', challengeData);
      socket.emit('challengeSent', {
        id: challengeId,
        opponentName: opponent.username,
        timestamp: Date.now()
      });
      
      setTimeout(() => {
        if (activeChallenges.has(challengeId)) {
          activeChallenges.delete(challengeId);
          io.to(socket.id).emit('challengeExpired', { challengeId });
          io.to(opponentId).emit('challengeExpired', { challengeId });
        }
      }, 60000);
      
    } catch (error) {
      console.error('Error processing challenge:', error);
      socket.emit('challengeFailed', { message: 'Failed to send challenge' });
    }
  });

  socket.on('respondToChallenge', async (data) => {
    try {
      const { challengeId, accepted, challengerId } = data;
      
      const challenge = activeChallenges.get(challengeId);
      if (!challenge) {
        socket.emit('challengeError', { message: 'Challenge not found or expired' });
        return;
      }
      
      activeChallenges.delete(challengeId);
      
      if (accepted) {
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const challenger = connectedPlayers.get(challengerId);
        if (!challenger) {
          socket.emit('challengeError', { message: 'Challenger no longer available' });
          return;
        }
        
        const gameData = {
          gameId: gameId,
          opponent: {
            id: challengerId,
            userId: challenger.userId,
            username: challenger.username,
            avatar: challenger.avatar,
            characterClass: challenger.characterClass || 'unselected'
          }
        };
        
        const challengerGameData = {
          gameId: gameId,
          opponent: {
            id: socket.id,
            userId: socket.user._id.toString(),
            username: socket.user.username,
            avatar: socket.user.avatar,
            characterClass: socket.user.characterClass || 'unselected'
          }
        };
        
        socket.emit('challengeAccepted', gameData);
        io.to(challengerId).emit('challengeAccepted', challengerGameData);
        
      } else {
        io.to(challengerId).emit('challengeRejected', {
          challengeId: challengeId,
          message: `${socket.user.username} declined your challenge`
        });
      }
      
    } catch (error) {
      console.error('Error responding to challenge:', error);
      socket.emit('challengeError', { message: 'Failed to respond to challenge' });
    }
  });

  // --- START OF REPLACEMENT ---
  socket.on('joinGame', async (gameId) => {
    try {
        console.log(`🎮 ${socket.user.username} joining game: ${gameId}`);
        
        // --- FIX: Atomic creation of the game object to prevent race conditions ---
        if (!activeGames.has(gameId)) {
            // Synchronously create a placeholder for the game to reserve the ID
            activeGames.set(gameId, {
                id: gameId,
                players: {},
                currentRound: 0,
                turnTimer: null,
                turnTime: 30,
                moves: {},
                waitingForPlayers: true,
                createdAt: Date.now()
            });
        }
        
        const game = activeGames.get(gameId);
        
        // Join the socket to the game room so they receive broadcasts
        socket.join(gameId);

        // Add the player to the game object if they are not already in it
        if (!game.players[socket.id]) {
            // Fetch all necessary data for this player asynchronously
            const stats = await Stats.findOne({ userId: socket.user._id });
            const inventory = await Inventory.findOne({ userId: socket.user._id });
            const playerLevel = await PlayerLevel.findOne({ userId: socket.user._id });
            const characterBonuses = getCharacterBonuses(socket.user.characterClass || 'unselected');

            // Construct the complete player data object
            const baseHealth = 100; // Assuming a base health
            const enduranceHP = ((stats?.endurance || 10) - 10) * 10;
            const maxHealth = baseHealth + enduranceHP;

            game.players[socket.id] = {
                socketId: socket.id,
                userId: socket.user._id.toString(),
                username: socket.user.username,
                avatar: socket.user.avatar,
                characterClass: socket.user.characterClass || 'unselected',
                health: maxHealth,
                maxHealth: maxHealth,
                stats: {
                    strength: (stats?.strength || 10),
                    agility: (stats?.agility || 10),
                    intuition: (stats?.intuition || 10),
                    endurance: (stats?.endurance || 10)
                },
                damageBonus: ((stats?.strength || 10) - 10) * 2,
                criticalChance: (stats?.intuition || 10) - 10,
                evasionChance: (stats?.agility || 10) - 10,
                enemyEvasionReduction: ((stats?.intuition || 10) - 10) * 0.5,
                specialAbility: characterBonuses.specialAbility,
                equipment: inventory?.equipped || {},
                level: playerLevel || { level: 1, totalXP: 0 },
                ready: true, // Player is now ready
                move: null
            };
        } else {
             // If player object exists (e.g., on reconnect), just mark as ready
             game.players[socket.id].ready = true;
        }

        const playerCount = Object.keys(game.players).length;
        const readyCount = Object.values(game.players).filter(p => p.ready).length;

        console.log(`Game ${gameId}: ${playerCount} players, ${readyCount} ready`);

        // If game is ready to start
        if (playerCount >= 2 && readyCount >= 2) {
            game.waitingForPlayers = false;
            game.currentRound = 0;
            
            console.log(`🎮 STARTING GAME ${gameId} with players:`, Object.values(game.players).map(p => p.username));
            
            io.to(gameId).emit('gameStarted', {
                gameState: { ...game, players: game.players }
            });
            
            setTimeout(() => {
                console.log(`🚀 CALLING startRound for ${gameId}`);
                startRound(gameId);
            }, 2000);
        } else {
            // If still waiting for players, just send the current state to the player who joined
            socket.emit('gameStarted', {
                gameState: { ...game, players: game.players }
            });
        }

    } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('gameError', { message: 'Failed to join game' });
    }
  });
  // --- END OF REPLACEMENT ---

  socket.on('makeMove', async (data) => {
    try {
      const { gameId, attackArea, blockArea } = data;
      console.log(`🎯 Move from ${socket.user.username}: attack=${attackArea}, block=${blockArea}`);
      
      const game = activeGames.get(gameId);
      if (!game || !game.players[socket.id] || game.moves[socket.id]) {
        socket.emit('invalidMove', { message: 'Invalid move' });
        return;
      }

      game.moves[socket.id] = {
        attackArea: attackArea,
        blockArea: blockArea,
        timestamp: Date.now(),
        auto: false
      };

      socket.emit('moveReceived', { success: true });
      socket.to(gameId).emit('opponentMadeMove', {
        playerId: socket.id,
        playerName: socket.user.username
      });

      const playerIds = Object.keys(game.players);
      const moveIds = Object.keys(game.moves);

      if (moveIds.length >= playerIds.length) {
        if (game.turnTimer) {
          clearTimeout(game.turnTimer);
          game.turnTimer = null;
        }
        
        io.to(gameId).emit('allMovesMade', { message: 'Processing round...' });
        setTimeout(() => processRound(gameId), 1000);
      }

    } catch (error) {
      console.error('Error processing move:', error);
      socket.emit('invalidMove', { message: 'Failed to process move' });
    }
  });

  socket.on('getPlayerList', () => {
    socket.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());
  });

  socket.on('disconnect', () => {
    const disconnectedPlayer = connectedPlayers.get(socket.id);
    if (disconnectedPlayer) {
      console.log(`Player disconnected: ${disconnectedPlayer.username}`);
      connectedPlayers.delete(socket.id);
      
      const userId = disconnectedPlayer.userId;
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        if (userSockets.get(userId).size === 0) {
            userSockets.delete(userId);
        }
      }

      // Clean up challenges
      activeChallenges.forEach((challenge, key) => {
        if (challenge.challengerId === socket.id || challenge.opponentId === socket.id) {
          activeChallenges.delete(key);
          const otherPlayerId = challenge.challengerId === socket.id ? challenge.opponentId : challenge.challengerId;
          io.to(otherPlayerId).emit('challengeCancelled', { 
            challengeId: key,
            reason: 'Player disconnected'
          });
        }
      });

      io.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());
    }
  });
});

// Database connection
mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB');
  await botManager.initializeBots();
})
.catch(err => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`🎮 FIXED: Game system with working round progression`);
});
