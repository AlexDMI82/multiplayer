
// Add this as the FIRST line in server.js
require('dotenv').config();

// server.js - Fully Refactored with Critical Fixes
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
const passport = require('./config/passport');

// Import models
const { User, Stats, Inventory, PlayerLevel } = require('./models');

// Import systems and handlers
const levelingSystem = require('./server/leveling-system');
const BotManager = require('./server/botManager');
const CombatSystem = require('./combat-system-server.js');
const GameUtils = require('./utils/gameUtils');

// Import handler classes
const ProfileHandlers = require('./handlers/profileHandlers');
const ShopHandlers = require('./handlers/shopHandlers');
const GameHandlers = require('./handlers/gameHandlers');
const ChallengeHandlers = require('./handlers/challengeHandlers');

// Global state maps
const activeChallenges = new Map();
const userSockets = new Map();
const connectedPlayers = new Map();
const activeGames = new Map();

// Initialize systems
const combatSystem = new CombatSystem();
// --- FIXED: Pass gameUtils to BotManager ---
const gameUtils = new GameUtils(io, combatSystem, activeGames, levelingSystem, userSockets);
const botManager = new BotManager(io, combatSystem, gameUtils);

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
    } else {
      // Ensure inventory structure is complete
      let needsSave = false;
      
      if (typeof inventory.gold !== 'number') {
        inventory.gold = 1000;
        needsSave = true;
      }
      
      if (!inventory.equipped || typeof inventory.equipped !== 'object') {
        inventory.equipped = {
          weapon: null, armor: null, shield: null, helmet: null,
          boots: null, gloves: null, amulet: null, ring: null
        };
        needsSave = true;
      }
      
      if (!Array.isArray(inventory.inventory)) {
        inventory.inventory = [];
        needsSave = true;
      }
      
      if (needsSave) {
        await inventory.save();
      }
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
app.use(passport.initialize());
app.use(passport.session());

// Authentication middleware
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

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/character-profile.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'character-profile.html')));
app.get('/profile.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/shop.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'shop.html')));
app.get('/profile', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/character-select.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'character-select.html')));
app.get('/inventory.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'inventory.html')));


// Google OAuth routes BEFORE your existing /api routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      console.log('✅ Google callback successful for user:', req.user.username);
      console.log('📋 User character class:', req.user.characterClass);
      
      // Generate JWT token for the user
      const token = generateToken(req.user._id);
      console.log('🔑 Token generated successfully');
      
      // Set token as cookie
      res.cookie('token', token, { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });
      console.log('🍪 Cookie set successfully');
      
      // Create HTML page that sets localStorage and redirects
      const redirectHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>Redirecting...</title></head>
        <body>
          <script>
            localStorage.setItem('token', '${token}');
            localStorage.setItem('user', JSON.stringify(${JSON.stringify({
              id: req.user._id,
              username: req.user.username,             
              characterClass: req.user.characterClass
            })}));
            
            // Redirect based on character selection
            ${req.user.characterClass ? 
              "window.location.href = '/';" : 
              "window.location.href = '/character-select.html';"
            }
          </script>
        </body>
        </html>
      `;
      
      res.send(redirectHTML);
      
    } catch (error) {
      console.error('❌ Error in Google callback:', error);
      res.redirect('/login.html?error=auth_failed');
    }
  }
);


// API Routes
app.post('/api/register', async (req, res) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  
  try {
    const { username, email, password} = req.body;   
  
    
    console.log('Registration request received:', { username, email});
    
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
    const user = new User({ username, email, password});
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
    let inventory = await ensureInventoryExists(userId);
    let playerLevel = await PlayerLevel.findOne({ userId });
    if (!playerLevel) playerLevel = await PlayerLevel.create({ userId, level: 1, totalXP: 0 });
    
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,       
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
    const { username, email} = req.body;
    const userId = req.user._id;

    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
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
        email: updatedUser.email       
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

// Make connectedPlayers globally available for bot manager
global.connectedPlayers = connectedPlayers;

// Socket.IO Connection Handler
io.on('connection', async (socket) => {
  const user = socket.user;
  const userId = user._id.toString();
  console.log(`Player connected: ${user.username} (Socket ID: ${socket.id})`);

  try {
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
      characterClass: user.characterClass || 'unselected',
      stats: stats,
      inventory: inventory,
      level: playerLevel ? playerLevel.level : 1,
      playerLevel: playerLevel
    };

    connectedPlayers.set(socket.id, playerData);
    
    // Emit updated player list including bots
    io.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());

    // Send initial profile data
    socket.emit('profileData', {
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,         
        characterClass: user.characterClass 
      },
      stats: stats,
      inventory: inventory,
      playerLevel: playerLevel
    });

    // Initialize all handler classes
    const profileHandlers = new ProfileHandlers(io, JWT_SECRET);
    const shopHandlers = new ShopHandlers(io);
    const gameHandlers = new GameHandlers(io, activeGames, connectedPlayers, gameUtils);
    const challengeHandlers = new ChallengeHandlers(io, activeChallenges, connectedPlayers, activeGames);

    // Register all handlers
    profileHandlers.registerHandlers(socket);
    shopHandlers.registerHandlers(socket);
    gameHandlers.registerHandlers(socket);
    challengeHandlers.registerHandlers(socket);

    // Additional critical handlers not covered by handler classes
    
    // Update stat handler (was missing)
    socket.on('updateStat', async (data) => {
      try {
        const { statType } = data;
        const userId = socket.user._id;
        
        console.log(`📊 Stat update request from ${socket.user.username}: ${statType}`);
        
        const validStats = ['strength', 'agility', 'intuition', 'endurance'];
        if (!validStats.includes(statType)) {
          socket.emit('statsUpdateFailed', { message: 'Invalid stat type' });
          return;
        }
        
        const stats = await Stats.findOne({ userId });
        if (!stats) {
          socket.emit('statsUpdateFailed', { message: 'Stats not found' });
          return;
        }
        
        if (stats.availablePoints <= 0) {
          socket.emit('statsUpdateFailed', { message: 'No available points' });
          return;
        }
        
        const updateData = {
          availablePoints: stats.availablePoints - 1,
          lastUpdated: Date.now()
        };
        updateData[statType] = stats[statType] + 1;
        
        const updatedStats = await Stats.findOneAndUpdate(
          { userId },
          updateData,
          { new: true }
        );
        
        console.log(`✅ Updated ${statType} for ${socket.user.username}. New value: ${updatedStats[statType]}, Available points: ${updatedStats.availablePoints}`);
        
        socket.emit('statUpdated', {
          statType: statType,
          newValue: updatedStats[statType],
          availablePoints: updatedStats.availablePoints,
          stats: {
            strength: updatedStats.strength,
            agility: updatedStats.agility,
            intuition: updatedStats.intuition,
            endurance: updatedStats.endurance,
            availablePoints: updatedStats.availablePoints
          }
        });
        
        socket.emit('statsUpdate', updatedStats);
        
      } catch (error) {
        console.error('Error updating stat:', error);
        socket.emit('statsUpdateFailed', { message: 'Failed to update stat' });
      }
    });

    // Request stats handler
    socket.on('requestStats', async () => {
      try {
        const userId = socket.user._id;
        const stats = await Stats.findOne({ userId });
        
        if (stats) {
          socket.emit('statsUpdate', stats);
        } else {
          console.error(`No stats found for user ${userId}`);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    });

    // Enhanced challenge player handler with bot support
    socket.on('challengePlayer', async (opponentId) => {
      try {
        // Check if challenging a bot FIRST
        if (opponentId.startsWith('bot_')) {
          console.log(`🤖 Player ${socket.user.username} challenging bot ${opponentId}`);
          
          const challengeData = {
            id: `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            challengerId: socket.id,
            opponentId: opponentId
          };
          
          // Handle bot challenge through bot manager
          if (botManager && typeof botManager.handleBotChallenge === 'function') {
            botManager.handleBotChallenge(socket.id, opponentId, challengeData);
          } else {
            console.error('❌ Bot manager not available or handleBotChallenge method missing');
            socket.emit('challengeFailed', { message: 'Bot challenges not available' });
          }
          return;
        }
        
        // Handle regular player challenges (delegate to challenge handlers)
        challengeHandlers.handlePlayerChallenge(socket, opponentId);
        
      } catch (error) {
        console.error('Error processing challenge:', error);
        socket.emit('challengeFailed', { message: 'Failed to send challenge' });
      }
    });

    // --- FIXED: Enhanced join game handler with correct bot logic ---
    socket.on('joinGame', async (gameId) => {
      try {
        console.log(`🎮 ${socket.user.username} is joining game: ${gameId}`);
        
        // 1. Let the human player join. This creates the game object.
        await gameHandlers.handleJoinGame(socket, gameId);
        
        // 2. Check if this is a bot game
        const botGameData = botManager.botGames.get(gameId);
        if (botGameData) {
          const game = activeGames.get(gameId);
          if (!game) {
              console.error(`❌ Game object not found for bot to join gameId: ${gameId}`);
              socket.emit('gameError', { message: 'Failed to initialize bot game.' });
              return;
          }
          
          console.log(`🤖 Bot is now joining the created game: ${gameId}`);
          // 3. Add the bot to the now-existing game
          await botManager.handleBotJoinGame(gameId, game);
          
          // 4. After bot joins, re-check if the game should start.
          // This logic is moved from gameHandlers to here to ensure it runs *after* the bot is added.
          const playerCount = Object.keys(game.players).length;
          const readyCount = Object.values(game.players).filter(p => p.ready).length;

          if (playerCount >= 2 && readyCount >= 2) {
            game.waitingForPlayers = false;
            game.currentRound = 0;
            
            console.log(`🎮 Starting bot game ${gameId} with players:`, Object.values(game.players).map(p => p.username));
            
            io.to(gameId).emit('gameStarted', {
              gameState: {
                ...game,
                players: game.players
              }
            });
            
            setTimeout(() => {
              gameUtils.startRound(gameId);
            }, 2000);
          }
        }
        
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('gameError', { message: 'Failed to join game' });
      }
    });

    // Enhanced make move handler with bot support
    socket.on('makeMove', async (data) => {
      try {
        const { gameId, attackArea, blockArea } = data;
        console.log(`🎯 Move from ${socket.user.username}: attack=${attackArea}, block=${blockArea}`);
        
        // Handle the move through game handlers first
        gameHandlers.handleMakeMove(socket, data);
        
        // Check if this game has a bot and trigger bot move
        const game = activeGames.get(gameId);
        const botGameData = botManager.botGames.get(gameId);
        if (botGameData && game && !game.moves[botGameData.botSocketId]) {
          console.log(`🤖 Triggering bot move for game ${gameId}`);
          setTimeout(() => {
            botManager.generateBotMove(gameId, game, game.currentRound);
          }, 500); // Small delay for realism
        }
        
      } catch (error) {
        console.error('Error processing move:', error);
        socket.emit('invalidMove', { message: 'Failed to process move' });
      }
    });

    // Get player list handler
    socket.on('getPlayerList', () => {
      socket.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error for user', socket.user.username, ':', error);
    });

    // Enhanced disconnect handler
    socket.on('disconnect', (reason) => {
      const disconnectedPlayer = connectedPlayers.get(socket.id);
      if (disconnectedPlayer) {
        console.log(`Player disconnected: ${disconnectedPlayer.username} (${reason})`);
        
        // Clean up active games
        activeGames.forEach((game, gameId) => {
          if (game.players[socket.id]) {
            console.log(`Cleaning up game ${gameId} for disconnected player ${disconnectedPlayer.username}`);
            
            // Notify other players
            socket.to(gameId).emit('opponentLeft', {
              playerId: socket.id,
              playerName: disconnectedPlayer.username,
              reason: 'disconnected'
            });
            
            // End game or remove player
            if (!game.waitingForPlayers) {
              const remainingPlayers = Object.keys(game.players).filter(id => id !== socket.id && !id.startsWith('bot_'));
              if (remainingPlayers.length > 0) {
                gameUtils.endGame(gameId, remainingPlayers[0]);
              }
            }
          }
        });
        
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

  } catch (error) {
    console.error('Error in socket connection handler:', error);
    socket.emit('connectionError', { message: 'Failed to initialize connection' });
  }
});

// Database connection and server startup
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
  console.log(`🎮 FULLY REFACTORED: Complete server with all handlers and bot integration`);
  console.log(`✅ Using organized handler files for clean architecture`);
  console.log(`🤖 Bot system fully integrated and operational`);
  console.log(`🔧 All critical missing handlers restored`);
});