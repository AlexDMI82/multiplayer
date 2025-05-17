// server.js - Updated with authentication, database, and level system
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { User, Stats, Inventory, PlayerLevel } = require('./models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// JWT Secret for token verification (used by both auth.js and socket authentication)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Create JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware to authenticate requests
const authenticate = async (req, res, next) => {
  try {
    // Get token from header or cookie
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      // Redirect to login page for web routes
      if (req.path.endsWith('.html') || req.path === '/profile') {
        return res.redirect('/login.html');
      }
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      // Redirect to login page for web routes
      if (req.path.endsWith('.html') || req.path === '/profile') {
        return res.redirect('/login.html');
      }
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // Redirect to login page for web routes
    if (req.path.endsWith('.html') || req.path === '/profile') {
      return res.redirect('/login.html');
    }
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Level system constants
const WINS_PER_LEVEL = 10;
const POINTS_PER_LEVEL = 5;

// Middleware
app.use(express.static('public'));
app.use(express.static(__dirname)); // Serve files from root directory
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Connect to MongoDB
mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Combat areas constants
const COMBAT_AREAS = ['head', 'body', 'legs'];
const BASE_DAMAGE = {
  'head': 25,  // Head attacks do more damage
  'body': 15,  // Body attacks do medium damage
  'legs': 10   // Leg attacks do less damage
};

// Store in-game state in memory (will be persisted to DB when needed)
const activePlayers = {};  // socketId -> userId
const challenges = {};
const activeGames = {};
const playerMoves = {};
const gameTurnTimers = {}; // To track turn timers
const playerMissedTurns = {}; // To track missed turns
const TURN_TIME_LIMIT = 30; // Default seconds for turn
const REDUCED_TIME_LIMIT = 10; // Reduced time after missing 3 turns
const MISSED_TURNS_THRESHOLD = 3; // Number of missed turns before reducing time

// Shop items definition (these could be moved to the database in the future)
const shopItems = {
  weapons: [
    { id: 'sword1', name: 'Basic Sword', type: 'weapon', damage: 5, price: 100 },
    { id: 'sword2', name: 'Steel Sword', type: 'weapon', damage: 10, price: 250 },
    { id: 'axe1', name: 'Battle Axe', type: 'weapon', damage: 15, price: 400 }
  ],
  armor: [
    { id: 'armor1', name: 'Leather Armor', type: 'armor', defense: 5, price: 150 },
    { id: 'armor2', name: 'Chain Mail', type: 'armor', defense: 10, price: 300 },
    { id: 'armor3', name: 'Plate Armor', type: 'armor', defense: 15, price: 500 }
  ],
  shields: [
    { id: 'shield1', name: 'Wooden Shield', type: 'shield', defense: 3, price: 100 },
    { id: 'shield2', name: 'Iron Shield', type: 'shield', defense: 8, price: 250 }
  ],
  helmets: [
    { id: 'helmet1', name: 'Leather Cap', type: 'helmet', defense: 2, price: 80 },
    { id: 'helmet2', name: 'Iron Helmet', type: 'helmet', defense: 5, price: 180 }
  ]
};

// Routes for authentication and registration
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Explicit routes for HTML files
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/character-profile.html', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'character-profile.html'));
});

app.get('/profile.html', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/shop.html', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'shop.html'));
});

// Keep the original profile route
app.get('/profile', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'profile.html'));
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username 
          ? 'Username already exists' 
          : 'Email already registered' 
      });
    }
    
    // Create new user
    const user = new User({ username, email, password, avatar });
    await user.save();
    
    // Create stats and inventory for the user
    await Stats.create({ userId: user._id });
    await Inventory.create({ userId: user._id });
    
    // Create player level
    await PlayerLevel.create({ userId: user._id, level: 1, wins: 0 });
    
    // Generate token
    const token = generateToken(user._id);
    
    // Set token in cookie
    res.cookie('token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Make sure avatar path is properly formatted
    let avatarPath = avatar;
    if (avatarPath && !avatarPath.startsWith('images/')) {
      avatarPath = `images/${avatarPath}`;
    }
    
    res.status(201).json({ 
      message: 'Registration successful',
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: avatarPath,
        characterClass: user.characterClass || null // Explicitly add characterClass
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Generate token
    const token = generateToken(user._id);
    
    // Set token in cookie
    res.cookie('token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Make sure avatar path is properly formatted
    let avatarPath = user.avatar;
    if (avatarPath && !avatarPath.startsWith('images/')) {
      avatarPath = `images/${avatarPath}`;
    }
    
    res.json({ 
      message: 'Login successful',
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: avatarPath,
        characterClass: user.characterClass || null // Explicitly add characterClass
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
});

// Get user profile
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user stats
    let stats = await Stats.findOne({ userId });
    if (!stats) {
      stats = await Stats.create({ userId });
    }
    
    // Get user inventory
    let inventory = await Inventory.findOne({ userId });
    if (!inventory) {
      inventory = await Inventory.create({ userId });
    }
    
    // Get or create player level
    let playerLevel = await PlayerLevel.findOne({ userId });
    if (!playerLevel) {
      playerLevel = await PlayerLevel.create({ userId, level: 1, wins: 0 });
    }
    
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin
      },
      stats: stats,
      inventory: inventory,
      level: playerLevel.level,
      wins: playerLevel.wins
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

// Update user profile
app.put('/api/profile', authenticate, async (req, res) => {
  try {
    const { username, email, avatar } = req.body;
    const userId = req.user._id;
    
    // Update user
    req.user.username = username || req.user.username;
    req.user.email = email || req.user.email;
    req.user.avatar = avatar || req.user.avatar;
    
    await req.user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
});

// Change password
app.put('/api/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    req.user.password = newPassword;
    await req.user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
});

// Get all online players
app.get('/api/players', authenticate, async (req, res) => {
  try {
    const onlinePlayers = await getOnlinePlayers();
    res.json(onlinePlayers);
  } catch (error) {
    console.error('Players fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch players', error: error.message });
  }
});

// SIMPLIFIED Socket.io authentication (no middleware)
io.on('connection', async (socket) => {
  console.log('New socket connection:', socket.id);
  
  // Handle authentication after user logs in
  socket.on('authenticate', async (token) => {
    try {
      // Verify token and get user ID
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;
      
      // Get user data from DB
      const user = await User.findById(userId);
      
      if (!user) {
        console.error('User not found for ID:', userId);
        socket.emit('authError', { message: 'User not found' });
        return;
      }
      
      // Get user stats and inventory
      let stats = await Stats.findOne({ userId });
      let inventory = await Inventory.findOne({ userId });
      
      // Create them if missing
      if (!stats) {
        console.log('Creating missing stats for user:', userId);
        stats = await Stats.create({ userId });
      }
      
      if (!inventory) {
        console.log('Creating missing inventory for user:', userId);
        inventory = await Inventory.create({ userId });
      }
      
      console.log('User authenticated:', user.username, socket.id);
      
      // Map socket ID to user ID
      activePlayers[socket.id] = userId;
      
      // Initialize missed turns counter
      playerMissedTurns[socket.id] = 0;
      
      // Notify all clients about the updated player list
      const onlinePlayers = await getOnlinePlayers();
      io.emit('playerList', onlinePlayers);
      
      // Send the player's stats back to them
      socket.emit('statsUpdate', stats);
      
      // Notify client of successful authentication
      socket.emit('authenticated', { 
        user: {
          id: user._id,
          username: user.username,
          avatar: user.avatar
        }
      });
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('authError', { message: 'Authentication failed' });
    }
  });
  
  // Handle request for stats
  socket.on('requestStats', async () => {
    try {
      const userId = activePlayers[socket.id];
      if (!userId) {
        console.log('No user ID for socket requesting stats:', socket.id);
        return;
      }
      
      console.log('User requesting stats:', userId);
      
      // Get user stats from DB
      let stats = await Stats.findOne({ userId });
      
      // Create stats if not exist
      if (!stats) {
        console.log('Creating new stats for user:', userId);
        stats = await Stats.create({ 
          userId,
          strength: 10,
          agility: 10,
          intuition: 10,
          endurance: 10,
          availablePoints: 3,
          totalWins: 0,
          totalLosses: 0
        });
      }
      
      console.log('Sending stats to user:', stats);
      
      // Send stats to client
      socket.emit('statsUpdate', stats);
    } catch (error) {
      console.error('Error handling requestStats:', error);
    }
  });
  
  // Get profile handler
  socket.on('getProfile', async () => {
    try {
      const userId = activePlayers[socket.id];
      if (!userId) {
        console.log('No user ID for socket requesting profile:', socket.id);
        socket.emit('profileError', { message: 'Not authenticated' });
        return;
      }
      
      console.log('User requesting profile:', userId);
      
      // Get user data
      const user = await User.findById(userId);
      
      // Get user stats
      let stats = await Stats.findOne({ userId });
      if (!stats) {
        stats = await Stats.create({ userId });
      }
      
      // Get user inventory
      let inventory = await Inventory.findOne({ userId });
      if (!inventory) {
        inventory = await Inventory.create({ userId });
      }
      
      // Get or create player level
      let playerLevel = await PlayerLevel.findOne({ userId });
      if (!playerLevel) {
        playerLevel = await PlayerLevel.create({ userId, level: 1, wins: 0 });
      }
      
      // Send profile data
      socket.emit('profileData', {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
        },
        stats: stats,
        inventory: inventory,
        level: playerLevel.level,
        wins: playerLevel.wins
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      socket.emit('profileError', { message: 'Failed to fetch profile data' });
    }
  });
  
  // Add a specific handler to get player list
  socket.on('getPlayerList', async () => {
    try {
      const onlinePlayers = await getOnlinePlayers();
      console.log('Sending player list to client:', onlinePlayers);
      socket.emit('playerList', onlinePlayers);
    } catch (error) {
      console.error('Error getting player list:', error);
    }
  });
  
  // Handle player challenge requests
  socket.on('challengePlayer', async (opponentSocketId) => {
    if (!activePlayers[socket.id] || !activePlayers[opponentSocketId]) {
      console.log('Invalid players for challenge:', socket.id, opponentSocketId);
      return;
    }
    
    const challengeId = Date.now().toString();
    challenges[challengeId] = {
      id: challengeId,
      challenger: socket.id,
      opponent: opponentSocketId,
      status: 'pending',
      timestamp: Date.now()
    };
    
    try {
      // Get challenger data
      const challenger = await User.findById(activePlayers[socket.id], 'username avatar');
      
      // Prepare challenger data for sending
      const challengerData = {
        id: socket.id,
        username: challenger.username,
        avatar: challenger.avatar.startsWith('images/') ? challenger.avatar : `images/${challenger.avatar}`
      };
      
      // Get all online players
      const onlinePlayers = await getOnlinePlayers();
      
      // Find opponent data
      const opponent = onlinePlayers.find(p => p.id === opponentSocketId);
      
      // Send challenge to opponent
      socket.to(opponentSocketId).emit('challengeReceived', {
        id: challengeId,
        challenger: challengerData
      });
      
      // Confirm to challenger
      socket.emit('challengeSent', {
        id: challengeId,
        opponent: opponent
      });
    } catch (error) {
      console.error('Error sending challenge:', error);
    }
  });
  
  // Handle challenge responses
  socket.on('respondToChallenge', async (data) => {
    const { challengeId, accept } = data;
    const challenge = challenges[challengeId];
    
    if (!challenge) {
      console.log('Challenge not found:', challengeId);
      return;
    }
    
    if (accept) {
      challenge.status = 'accepted';
      // Create a unique game ID that is shared between both players
      const gameId = 'game_' + challengeId;
      console.log(`Challenge accepted: creating game ${gameId}`);
      
      // Create the game instance immediately
      if (!activeGames[gameId]) {
        activeGames[gameId] = {
          id: gameId,
          players: {},
          status: 'waiting',
          moves: [],
          turnStartTime: null,
          roundNumber: 0
        };
        console.log(`Game instance created: ${gameId}`);
      }
      
      try {
        // Get opponent data
        const getPlayerData = async (socketId) => {
          const userId = activePlayers[socketId];
          const user = await User.findById(userId, 'username avatar');
          return {
            id: socketId,
            username: user.username,
            avatar: user.avatar.startsWith('images/') ? user.avatar : `images/${user.avatar}`
          };
        };
        
        // Get data for both players
        const [opponentData, challengerData] = await Promise.all([
          getPlayerData(challenge.opponent),
          getPlayerData(challenge.challenger)
        ]);
        
        // Notify both players about accepted challenge with the SAME gameId
        io.to(challenge.challenger).emit('challengeAccepted', {
          gameId,
          opponent: opponentData
        });
        
        io.to(challenge.opponent).emit('challengeAccepted', {
          gameId,
          opponent: challengerData
        });
      } catch (error) {
        console.error('Error handling challenge acceptance:', error);
      }
    } else {
      challenge.status = 'rejected';
      io.to(challenge.challenger).emit('challengeRejected', {
        challengeId,
        opponentId: challenge.opponent
      });
    }
  });
  
  // Handle stats update from client
  socket.on('updateStats', async (statsData) => {
    try {
        const userId = activePlayers[socket.id];
        if (!userId) {
            console.log('No user ID for socket updating stats:', socket.id);
            socket.emit('statsUpdateError', { message: 'Not authenticated' });
            return;
        }
      
      console.log('Received stats update from user:', userId, statsData);
      
   // Validate the stats update
        if (validateStats(statsData)) {
            // Make sure we sanitize the data and don't allow cheating
            const cleanedStats = {
                strength: Math.min(50, Math.max(10, statsData.strength || 10)),
                agility: Math.min(50, Math.max(10, statsData.agility || 10)),
                intuition: Math.min(50, Math.max(10, statsData.intuition || 10)),
                endurance: Math.min(50, Math.max(10, statsData.endurance || 10)),
                availablePoints: Math.max(0, statsData.availablePoints || 0),
                totalWins: statsData.totalWins || 0,
                totalLosses: statsData.totalLosses || 0
            };
        
                // Update stats in database
            const updatedStats = await Stats.findOneAndUpdate(
                { userId }, 
                cleanedStats, 
                { new: true, upsert: true }
            );
        
        console.log('Stats updated successfully:', updatedStats);
        
            // Send updated stats back to client
              socket.emit('statsUpdate', updatedStats);
            
            // NEW: Update game state if player is in a game
            // Find if player is in any active game
            for (const gameId of Object.keys(activeGames)) {
                const game = activeGames[gameId];
                if (game.players[socket.id]) {
                    // Update rawStats in game state
                    game.players[socket.id].rawStats = {
                        strength: cleanedStats.strength,
                        agility: cleanedStats.agility,
                        intuition: cleanedStats.intuition,
                        endurance: cleanedStats.endurance
                    };
                    
                    // Update derived stats
                    game.players[socket.id].damageBonus = cleanedStats.strength * 2;
                    game.players[socket.id].evasionChance = cleanedStats.agility;
                    game.players[socket.id].criticalChance = cleanedStats.intuition;
                    game.players[socket.id].enemyEvasionReduction = cleanedStats.intuition * 0.5;
                    game.players[socket.id].maxHealth = 100 + (cleanedStats.endurance * 10);
                    
                    // Notify all players in the game about the stat update
                    io.to(gameId).emit('gameStateUpdate', {
                        gameId,
                        players: game.players
                    });
                    
                    break; // Only need to update one game
                }
            }
        } else {
            console.warn('Invalid stats update rejected:', statsData);
            
            // Get current stats to send back
            const currentStats = await Stats.findOne({ userId });
            socket.emit('statsUpdate', currentStats);
        }
    } catch (error) {
        console.error('Error processing stats update:', error);
        
        try {
            // Try to send current stats back
            const userId = activePlayers[socket.id];
            if (userId) {
                const currentStats = await Stats.findOne({ userId });
                if (currentStats) {
                    socket.emit('statsUpdate', currentStats);
                }
            }
        } catch (secondError) {
            console.error('Error retrieving current stats:', secondError);
        }
    }
});
  
  // Game mechanics - similar to your original code but with DB integration
  socket.on('joinGame', async (gameId) => {
    console.log(`Player ${socket.id} joining game: ${gameId}`);
    
    // Reset missed turns counter when joining game
    playerMissedTurns[socket.id] = 0;
    
    // Check if game exists
    if (!activeGames[gameId]) {
      console.log(`Creating new game with ID: ${gameId}`);
      activeGames[gameId] = {
        id: gameId,
        players: {},
        status: 'waiting',
        moves: [],
        turnStartTime: null,
        roundNumber: 0
      };
    }
    
    // Add player to game
    const playerId = socket.id;
    const userId = activePlayers[playerId];
    
    if (userId) {
      try {
        // Get user data from DB
        const user = await User.findById(userId);
        const userStats = await Stats.findOne({ userId });
        const userInventory = await Inventory.findOne({ userId });
        
        console.log(`Adding player ${user.username} to game ${gameId}`);
        
        // Get player's equipment
        const equipment = {
          weapon: userInventory.equipped.weapon || null,
          armor: userInventory.equipped.armor || null,
          shield: userInventory.equipped.shield || null,
          helmet: userInventory.equipped.helmet || null
        };
        
        // Calculate max health based on endurance
        const maxHealth = 100 + (userStats.endurance * 10);
        
        // Add player to game with initial stats and combat bonuses
        activeGames[gameId].players[playerId] = {
          id: playerId,
          userId: userId.toString(),
          username: user.username,
          avatar: user.avatar.startsWith('images/') ? user.avatar : `images/${user.avatar}`,
          health: maxHealth,
          maxHealth: maxHealth,
          energy: 100,
          equipment: equipment,
          turnTimeLimit: TURN_TIME_LIMIT, // Default time limit
          // Combat stat bonuses
          damageBonus: userStats.strength * 2,
          evasionChance: userStats.agility,
          criticalChance: userStats.intuition,
          enemyEvasionReduction: userStats.intuition * 0.5,
          // NEW: Add raw stats for UI display
                rawStats: {
                    strength: userStats.strength,
                    agility: userStats.agility,
                    intuition: userStats.intuition,
                    endurance: userStats.endurance
                }
        };
        
        // Join socket room for this game
        socket.join(gameId);
        
        // Log existing players in this game
        const game = activeGames[gameId];
        const playerIds = Object.keys(game.players);
        console.log(`Game ${gameId} now has ${playerIds.length} players:`, playerIds);
        
        if (playerIds.length === 2) {
          // Force a delay to ensure both clients are ready
          setTimeout(() => {
            console.log(`Starting game ${gameId} with players:`, playerIds);
            
            // Start first round
            startNewRound(gameId);
          }, 1000);
        }
      } catch (error) {
        console.error('Error joining game:', error);
      }
    } else {
      console.error('No userId found for socket ID:', playerId);
    }
  });
  
  // Handling a rejoin attempt
socket.on('rejoinGame', async (gameId) => {
  if (activeGames[gameId]) {
    console.log(`Player ${socket.id} attempting to rejoin game: ${gameId}`);
    
    // Check if this player was the one who left
    if (activeGames[gameId].playerLeft && activeGames[gameId].playerLeft.playerId === socket.id) {
      // Clear the abandonment timer
      if (activeGames[gameId].abandonmentTimer) {
        clearTimeout(activeGames[gameId].abandonmentTimer);
        delete activeGames[gameId].abandonmentTimer;
      }
      
      // Clear the player left flag
      delete activeGames[gameId].playerLeft;
      
      // Notify the other player that their opponent has returned
      const otherPlayerId = Object.keys(activeGames[gameId].players)
        .find(id => id !== socket.id);
        
      if (otherPlayerId) {
        io.to(otherPlayerId).emit('opponentRejoined', {
          gameId,
          message: "Your opponent has returned to the battle!"
        });
      }
      
      console.log(`Player ${socket.id} successfully rejoined game ${gameId}`);
    }
    
    // Use the regular join game logic
    socket.emit('joinGame', gameId);
  } else {
    console.log(`Game ${gameId} no longer exists for rejoin`);
    socket.emit('gameNotFound', { gameId });
  }
});
  
  // Start a new round of gameplay
  function startNewRound(gameId) {
    const game = activeGames[gameId];
    if (!game) return;
    
    game.roundNumber++;
    game.status = 'in_progress';
    
    // Clear any previous moves
    playerMoves[gameId] = {};
    
    // Set turn start time
    game.turnStartTime = Date.now();
    
    // Notify players that a new round is starting
    io.to(gameId).emit('roundStarted', {
      gameId,
      roundNumber: game.roundNumber,
      players: game.players,
      turnTimeLimit: TURN_TIME_LIMIT,
      combatAreas: COMBAT_AREAS // Send available combat areas
    });
    
    // Clear any existing turn timer
    if (gameTurnTimers[gameId]) {
      clearTimeout(gameTurnTimers[gameId]);
    }
    
    // Start turn timer - this will force the turn to end if time runs out
    gameTurnTimers[gameId] = setTimeout(() => {
      // Process turn when time runs out
      processTimeoutTurn(gameId);
    }, TURN_TIME_LIMIT * 1000);
  }
  
  // Process timeout when turn time runs out
  function processTimeoutTurn(gameId) {
    // ... [Same as your original processTimeoutTurn function]
    const game = activeGames[gameId];
    if (!game || game.status !== 'in_progress') return;
    
    // Get players who haven't made moves
    const playerIds = Object.keys(game.players);
    const playersWithoutMoves = playerIds.filter(id => !playerMoves[gameId] || !playerMoves[gameId][id]);
    
    // Auto-generate 'skip' moves for players who didn't make a move
    playersWithoutMoves.forEach(playerId => {
      // Increment missed turns counter
      playerMissedTurns[playerId] = (playerMissedTurns[playerId] || 0) + 1;
      
      // Check if player has missed too many turns
      if (playerMissedTurns[playerId] >= MISSED_TURNS_THRESHOLD) {
        // Reduce player's turn time limit
        game.players[playerId].turnTimeLimit = REDUCED_TIME_LIMIT;
      }
      
      // Create a "skip" move with no attack or block
      if (!playerMoves[gameId]) {
        playerMoves[gameId] = {};
      }
      
      playerMoves[gameId][playerId] = {
        attackArea: null,
        blockArea: null,
        timestamp: Date.now(),
        auto: true // Flag to indicate this was auto-generated
      };
      
      // Notify all players about the skipped turn
      io.to(gameId).emit('playerSkippedTurn', {
        playerId,
        playerName: game.players[playerId].username
      });
    });
    
    // Now process the turn with whatever moves we have
    if (Object.keys(playerMoves[gameId] || {}).length === playerIds.length) {
      // First, broadcast that all moves have been made (or auto-generated)
      io.to(gameId).emit('allMovesMade', {
        gameId,
        playerMoves: Object.keys(playerMoves[gameId]).map(playerId => ({
          playerId,
          attackArea: playerMoves[gameId][playerId].attackArea,
          blockArea: playerMoves[gameId][playerId].blockArea,
          auto: playerMoves[gameId][playerId].auto || false
        }))
      });
      
      // Process the round
      setTimeout(() => {
        processRound(gameId);
      }, 1000);
    }
  }
  
  socket.on('makeMove', (data) => {
    // ... [Same as your original makeMove handler]
    const { gameId, attackArea, blockArea } = data;
    const playerId = socket.id;
    
    const game = activeGames[gameId];
    if (!game || game.status !== 'in_progress') {
      return;
    }
    
    // Validate move - attack and block areas must be valid
    if (!COMBAT_AREAS.includes(attackArea) || !COMBAT_AREAS.includes(blockArea)) {
      socket.emit('invalidMove', { reason: 'Invalid attack or block area' });
      return;
    }
    
    // Reset missed turns counter when player makes a move
    playerMissedTurns[playerId] = 0;
    
    // Initialize player moves for this game if not exists
    if (!playerMoves[gameId]) {
      playerMoves[gameId] = {};
    }
    
    // Store this player's move
    playerMoves[gameId][playerId] = {
      attackArea,
      blockArea,
      timestamp: Date.now()
    };
    
    // Check if both players have made their moves
    const playerIds = Object.keys(game.players);
    const allMovesSubmitted = playerIds.every(id => playerMoves[gameId][id]);
    
    // Inform player their move has been received
    socket.emit('moveReceived', { attackArea, blockArea });
    
    // Inform opponent that a move has been made (without revealing which move)
    const opponentId = playerIds.find(id => id !== playerId);
    if (opponentId) {
      socket.to(opponentId).emit('opponentMadeMove');
    }
    
    if (allMovesSubmitted) {
      // Clear turn timer as both players have moved
      if (gameTurnTimers[gameId]) {
        clearTimeout(gameTurnTimers[gameId]);
        delete gameTurnTimers[gameId];
      }
      
      // First, broadcast that both players have made their moves
      io.to(gameId).emit('allMovesMade', {
        gameId,
        playerMoves: Object.keys(playerMoves[gameId]).map(playerId => ({
          playerId,
          attackArea: playerMoves[gameId][playerId].attackArea,
          blockArea: playerMoves[gameId][playerId].blockArea,
          auto: playerMoves[gameId][playerId].auto || false
        }))
      });
      
      // Wait a short time to ensure clients receive the message
      setTimeout(() => {
        // Process the round results
        processRound(gameId);
      }, 1000);
    }
  });
  
  // Process round results - extends original with DB updates
  async function processRound(gameId) {
    // Similar to original processRound but with DB updates for stats
    const game = activeGames[gameId];
    const moves = playerMoves[gameId];
    const playerIds = Object.keys(game.players);
    
    // Create result object to track damage
    const roundResult = {
      moves: moves,
      damageDealt: {},
      combatLog: []
    };
    
    // Process each player's move against the other
    playerIds.forEach(attackerId => {
      const defenderId = playerIds.find(id => id !== attackerId);
      const attacker = game.players[attackerId];
      const defender = game.players[defenderId];
      const attackerMove = moves[attackerId];
      const defenderMove = moves[defenderId];
      
      // Initialize damage for this player
      roundResult.damageDealt[attackerId] = 0;
      
      // Skip if attacker didn't make a move or chose no attack area
      if (!attackerMove || !attackerMove.attackArea || attackerMove.auto) {
        roundResult.combatLog.push({
          type: 'skip',
          player: attackerId,
          message: `${attacker.username} did not attack.`
        });
        return;
      }
      
      // Check if defender successfully blocked
      const successfulBlock = defenderMove && 
                               defenderMove.blockArea === attackerMove.attackArea;
      
      // Roll for evasion if not blocked
      let wasEvaded = false;
      if (!successfulBlock) {
        // Base evasion chance from agility (1% per point)
        let evasionChance = defender.evasionChance || 0;
        
        // Reduce evasion chance based on attacker's intuition
        const evasionReduction = attacker.enemyEvasionReduction || 0;
        evasionChance = Math.max(0, evasionChance - evasionReduction);
        
        // Roll for evasion (random number from 1-100)
        const roll = Math.floor(Math.random() * 100) + 1;
        wasEvaded = roll <= evasionChance;
      }
      
      // If attack was blocked or evaded, no damage
      if (successfulBlock) {
        roundResult.damageDealt[attackerId] = 0;
        roundResult.combatLog.push({
          type: 'block',
          player: defenderId,
          message: `${defender.username} blocked ${attacker.username}'s attack to the ${attackerMove.attackArea}!`
        });
      } else if (wasEvaded) {
        roundResult.damageDealt[attackerId] = 0;
        roundResult.combatLog.push({
          type: 'evade',
          player: defenderId,
          message: `${defender.username} evaded ${attacker.username}'s attack to the ${attackerMove.attackArea}!`
        });
      } else {
        // Attack hits - calculate damage
        
        // Get base damage for the attack area
        let damage = BASE_DAMAGE[attackerMove.attackArea] || 0;
        
        // Add weapon damage if equipped
        if (attacker.equipment && attacker.equipment.weapon) {
          damage += attacker.equipment.weapon.damage || 0;
        }
        
        // Add strength bonus (2 damage per strength point)
        if (attacker.damageBonus) {
          damage += attacker.damageBonus;
        }
        
        // Roll for critical hit
        let isCritical = false;
        const criticalChance = attacker.criticalChance || 0;
        const critRoll = Math.floor(Math.random() * 100) + 1;
        
        if (critRoll <= criticalChance) {
          damage *= 2;
          isCritical = true;
        }
        
        // Apply armor and shield defense
        let totalDefense = 0;
        
        // Apply armor defense if equipped
        if (defender.equipment && defender.equipment.armor) {
          totalDefense += defender.equipment.armor.defense || 0;
        }
        
        // Apply shield defense if equipped
        if (defender.equipment && defender.equipment.shield) {
          totalDefense += defender.equipment.shield.defense || 0;
        }
        
        // Apply helmet defense if equipped
        if (defender.equipment && defender.equipment.helmet) {
          totalDefense += defender.equipment.helmet.defense || 0;
        }
        
        // Reduce damage by total defense, but not below 1
        damage = Math.max(1, damage - totalDefense);
        
        // Apply the damage to defender
        defender.health = Math.max(0, defender.health - damage);
        
        // Record the damage dealt
        roundResult.damageDealt[attackerId] = damage;
        
        // Add to combat log
        roundResult.combatLog.push({
          type: 'hit',
          player: attackerId,
          targetArea: attackerMove.attackArea,
          damage: damage,
          critical: isCritical,
          message: isCritical 
            ? `CRITICAL HIT! ${attacker.username} hit ${defender.username}'s ${attackerMove.attackArea} for ${damage} damage!`
            : `${attacker.username} hit ${defender.username}'s ${attackerMove.attackArea} for ${damage} damage!`
        });
      }
      
      // Record the move in the game history
      game.moves = game.moves || [];
      game.moves.push({
        player: attackerId,
        attackArea: attackerMove.attackArea,
        blockArea: attackerMove.blockArea,
        damage: roundResult.damageDealt[attackerId],
        blocked: successfulBlock,
        evaded: wasEvaded,
        timestamp: attackerMove.timestamp
      });
    });
    
    // Check if game is over
    let gameOver = false;
    let winner = null;
    
    playerIds.forEach(playerId => {
      if (game.players[playerId].health <= 0) {
        gameOver = true;
        winner = playerIds.find(id => id !== playerId);
        
        roundResult.combatLog.push({
          type: 'defeat',
          player: playerId,
          message: `${game.players[playerId].username} has been defeated!`
        });
        
        roundResult.combatLog.push({
          type: 'victory',
          player: winner,
          message: `${game.players[winner].username} is victorious!`
        });
      }
    });
    
    // Send round results to all players
    io.to(gameId).emit('roundResult', {
      gameId,
      roundNumber: game.roundNumber,
      players: game.players,
      moves: roundResult.moves,
      damageDealt: roundResult.damageDealt,
      combatLog: roundResult.combatLog,
      gameOver,
      winner
    });
    
    // If game is over, handle end of game with DB updates
    if (gameOver) {
      game.status = 'completed';
      game.winner = winner;
      
      try {
        // Get user IDs for winner and loser
        const winnerId = activePlayers[winner];
        const loserId = activePlayers[playerIds.find(id => id !== winner)];
        
        if (winnerId && loserId) {
          // Update winner's gold in DB
          await Inventory.findOneAndUpdate(
            { userId: winnerId },
            { $inc: { gold: 50 } }
          );
          
          // Award 1 stat point to winner
          await Stats.findOneAndUpdate(
            { userId: winnerId },
            { $inc: { availablePoints: 1, totalWins: 1 } }
          );
          
          // Update loser's stats
          await Stats.findOneAndUpdate(
            { userId: loserId },
            { $inc: { totalLosses: 1 } }
          );
          
          // Update player level record for winner
          let playerLevel = await PlayerLevel.findOne({ userId: winnerId });
          
          if (playerLevel) {
            // Increment wins
            playerLevel.wins += 1;
            
            // Check if player leveled up
            const winsForNextLevel = playerLevel.level * WINS_PER_LEVEL;
            
            if (playerLevel.wins >= winsForNextLevel) {
              // Level up!
              playerLevel.level += 1;
              
              // Award bonus points
              await Stats.findOneAndUpdate(
                { userId: winnerId },
                { $inc: { availablePoints: POINTS_PER_LEVEL } }
              );
              
              // Notify player of level up
              io.to(winner).emit('levelUp', {
                level: playerLevel.level,
                bonusPoints: POINTS_PER_LEVEL
              });
            }
            
            // Save updated level
            await playerLevel.save();
          } else {
            // Create new player level record if not exists
            await PlayerLevel.create({
              userId: winnerId,
              level: 1,
              wins: 1
            });
          }
          
          // Get updated stats for the winner
          const winnerStats = await Stats.findOne({ userId: winnerId });
          
          // Notify the winner about their stat point
          io.to(winner).emit('statsUpdate', winnerStats);
          io.to(winner).emit('statPointAwarded', {
            message: 'You earned 1 stat point for winning!',
            points: 1
          });
        }
      } catch (error) {
        console.error('Error updating stats after game:', error);
      }
      
      // Notify about game end
      io.to(gameId).emit('gameOver', {
        winner,
        players: game.players,
        reward: 50
      });
    } else {
      // Start a new round after a delay
      setTimeout(() => {
        startNewRound(gameId);
      }, 3000); // 3 second delay before starting next round
    }
  }
  
socket.on('leaveGame', async (gameId) => {
  if (activeGames[gameId]) {
    const playerId = socket.id;
    
    // Clear any existing turn timer
    if (gameTurnTimers[gameId]) {
      clearTimeout(gameTurnTimers[gameId]);
      delete gameTurnTimers[gameId];
    }
    
    // Create abandonment timer if game is in progress
    if (activeGames[gameId].status === 'in_progress') {
      const otherPlayerId = Object.keys(activeGames[gameId].players)
        .find(id => id !== playerId);
      
      if (otherPlayerId) {
        // Mark the game as having a player who left
        activeGames[gameId].playerLeft = {
          playerId: playerId,
          timestamp: Date.now()
        };
        
        // Set a 10-second abandonment timer
activeGames[gameId].abandonmentTimer = setTimeout(async () => {
  try {
    console.log(`ABANDONMENT TIMER FIRED: Player ${playerId} abandoned game ${gameId}`);
    
    // Get user IDs
    const otherPlayerId = Object.keys(activeGames[gameId].players).find(id => id !== playerId);
    const otherUserId = activePlayers[otherPlayerId];
    const userId = activePlayers[playerId];
    
    console.log(`Awarding win to ${otherPlayerId}, otherUserId: ${otherUserId}`);
    
    // Mark game as completed with a forfeit win
    activeGames[gameId].status = 'completed';
    activeGames[gameId].winner = otherPlayerId;
    
    // Award gold and stats
    await Inventory.findOneAndUpdate(
      { userId: otherUserId },
      { $inc: { gold: 25 } } // Forfeit reward
    );
    
    // Update winner's stats
    await Stats.findOneAndUpdate(
      { userId: otherUserId },
      { $inc: { availablePoints: 1, totalWins: 1 } }
    );
    
    // Update leaver's stats
    if (userId) {
      await Stats.findOneAndUpdate(
        { userId },
        { $inc: { totalLosses: 1 } }
      );
    }
    
    // Get updated stats
    const winnerStats = await Stats.findOne({ userId: otherUserId });
    
    // Ensure we send the opponentAbandoned event
    console.log(`SENDING opponentAbandoned to ${otherPlayerId}`);
    io.to(otherPlayerId).emit('opponentAbandoned', {
      gameId,
      winner: otherPlayerId,
      message: "Your opponent abandoned the game. You win!",
      reward: 25
    });
    
    // Also send a direct message to confirm it was sent
    io.to(otherPlayerId).emit('debugMessage', {
      message: "Abandonment timer completed. Victory awarded."
    });
    
  } catch (error) {
    console.error('Error processing game abandonment:', error);
  } finally {
    // Always clear the abandonment timer data
    console.log(`Cleaning up abandonment timer for game ${gameId}`);
    delete activeGames[gameId].abandonmentTimer;
    delete activeGames[gameId].playerLeft;
  }
}, 10000); // 10 second timeout
        
        // Notify the other player that their opponent has left
        io.to(otherPlayerId).emit('opponentLeftBattle', {
          gameId,
          message: "Your opponent left the battle. If they don't return in 10 seconds, you'll win by forfeit!"
        });
      }
    }
    
    // Remove player from game
    socket.leave(gameId);
    
    // Clean up empty games after delay
    setTimeout(() => {
      if (activeGames[gameId] && 
          Object.keys(activeGames[gameId].players).length === 0) {
        delete activeGames[gameId];
      }
    }, 15000); // longer than the abandonment timer
  }
});
  
  // Shop and inventory handlers with DB integration
  socket.on('getShopItems', () => {
    socket.emit('shopItems', shopItems);
  });
  
  socket.on('getInventory', async () => {
    try {
      const userId = activePlayers[socket.id];
      if (userId) {
        let inventory = await Inventory.findOne({ userId });
        
        // Create inventory if it doesn't exist
        if (!inventory) {
          inventory = await Inventory.create({ userId });
        }
        
        socket.emit('inventory', {
          gold: inventory.gold,
          equipped: inventory.equipped,
          inventory: inventory.inventory
        });
      } else {
        console.log('No userId found for socket requesting inventory:', socket.id);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  });
  
  socket.on('buyItem', async (itemData) => {
    try {
      const userId = activePlayers[socket.id];
      const { itemId, itemType } = itemData;
      
      if (!userId) {
        socket.emit('purchaseFailed', { reason: 'Authentication required' });
        return;
      }
      
      // Find item in shop
      const itemCategory = itemType + 's'; // Convert 'weapon' to 'weapons', etc.
      const item = shopItems[itemCategory].find(i => i.id === itemId);
      
      // Get user's inventory
      let inventory = await Inventory.findOne({ userId });
      
      // Create inventory if it doesn't exist
      if (!inventory) {
        inventory = await Inventory.create({ userId });
      }
      
      if (item && inventory && inventory.gold >= item.price) {
        // Deduct gold and add item to inventory
        inventory.gold -= item.price;
        inventory.inventory.push({...item});
        
        // Save to DB
        await inventory.save();
        
        // Confirm purchase
        socket.emit('purchaseComplete', {
          item,
          newGold: inventory.gold
        });
      } else {
        socket.emit('purchaseFailed', {
          reason: !item ? 'Item not found' : 'Not enough gold'
        });
      }
    } catch (error) {
      console.error('Error processing purchase:', error);
      socket.emit('purchaseFailed', { reason: 'Server error' });
    }
  });
  
  socket.on('equipItem', async (itemData) => {
    try {
      const userId = activePlayers[socket.id];
      const { itemId, itemType } = itemData;
      
      if (!userId) {
        console.log('No userId found for socket trying to equip item:', socket.id);
        return;
      }
      
      // Get user's inventory
      let inventory = await Inventory.findOne({ userId });
      
      // Create inventory if it doesn't exist
      if (!inventory) {
        inventory = await Inventory.create({ userId });
      }
      
      // Find item in player's inventory
      const itemIndex = inventory.inventory.findIndex(i => i.id === itemId && i.type === itemType);
      
      if (itemIndex !== -1) {
        const item = inventory.inventory[itemIndex];
        
        // Unequip current item if any
        if (inventory.equipped[itemType]) {
          inventory.inventory.push(inventory.equipped[itemType]);
        }
        
        // Equip new item
        inventory.equipped[itemType] = item;
        
        // Remove from inventory
        inventory.inventory.splice(itemIndex, 1);
        
        // Save to DB
        await inventory.save();
        
        // Confirm equipment change
        socket.emit('equipmentUpdated', {
          equipped: inventory.equipped,
          inventory: inventory.inventory
        });
      } else {
        console.log('Item not found in inventory:', itemId, itemType);
      }
    } catch (error) {
      console.error('Error equipping item:', error);
    }
  });
  
  // Handle player disconnect with DB updates
socket.on('disconnect', async () => {
  console.log('User disconnected:', socket.id);
  
  // Clean up missed turns counter
  delete playerMissedTurns[socket.id];
  
  const userId = activePlayers[socket.id];
  if (userId) {
    delete activePlayers[socket.id];
    
    // Notify all clients about the updated player list
    const onlinePlayers = await getOnlinePlayers();
    io.emit('playerList', onlinePlayers);
    
    // Auto-reject any pending challenges
    Object.values(challenges).forEach(challenge => {
      if ((challenge.opponent === socket.id || challenge.challenger === socket.id) && 
          challenge.status === 'pending') {
        challenge.status = 'rejected';
        
        if (challenge.opponent === socket.id) {
          io.to(challenge.challenger).emit('challengeRejected', {
            challengeId: challenge.id,
            opponentId: socket.id,
            reason: 'Player disconnected'
          });
        }
      }
    });
    
    // Handle any active games with forfeit processing and DB updates
    for (const gameId of Object.keys(activeGames)) {
      const game = activeGames[gameId];
      if (game.players[socket.id] && game.status === 'in_progress') {
        // Clear any turn timer
        if (gameTurnTimers[gameId]) {
          clearTimeout(gameTurnTimers[gameId]);
          delete gameTurnTimers[gameId];
        }
        
        // Clear any abandonment timer if the fully disconnected player was marked as having left
        if (game.playerLeft && game.playerLeft.playerId === socket.id && game.abandonmentTimer) {
          clearTimeout(game.abandonmentTimer);
          delete game.abandonmentTimer;
          delete game.playerLeft;
        }
        
        const otherPlayerId = Object.keys(game.players).find(id => id !== socket.id);
        
        if (otherPlayerId) {
          try {
            const otherUserId = activePlayers[otherPlayerId];
            
            game.status = 'completed';
            game.winner = otherPlayerId;
            
            // Add forfeit reward
            await Inventory.findOneAndUpdate(
              { userId: otherUserId },
              { $inc: { gold: 25 } } // Forfeit reward
            );
            
            // Update stats for win and loss
            await Stats.findOneAndUpdate(
              { userId: otherUserId },
              { $inc: { availablePoints: 1, totalWins: 1 } }
            );
            
            await Stats.findOneAndUpdate(
              { userId },
              { $inc: { totalLosses: 1 } }
            );
            
            // Update winner's level for forfeit
            let playerLevel = await PlayerLevel.findOne({ userId: otherUserId });
            if (playerLevel) {
              playerLevel.wins += 1;
              
              // Check for level up
              const winsForNextLevel = playerLevel.level * WINS_PER_LEVEL;
              if (playerLevel.wins >= winsForNextLevel) {
                playerLevel.level += 1;
                
                // Award bonus points
                await Stats.findOneAndUpdate(
                  { userId: otherUserId },
                  { $inc: { availablePoints: POINTS_PER_LEVEL } }
                );
                
                // Notify player of level up
                io.to(otherPlayerId).emit('levelUp', {
                  level: playerLevel.level,
                  bonusPoints: POINTS_PER_LEVEL
                });
              }
              
              await playerLevel.save();
            }
            
            // Get updated stats
            const winnerStats = await Stats.findOne({ userId: otherUserId });
            
            // Notify the winner about their stat point
            io.to(otherPlayerId).emit('statsUpdate', winnerStats);
            io.to(otherPlayerId).emit('statPointAwarded', {
              message: 'You earned 1 stat point because your opponent disconnected!',
              points: 1
            });
            
            // Send a specific event for disconnection forfeit, not just a regular 'opponentLeft'
            io.to(otherPlayerId).emit('opponentDisconnected', {
              gameId,
              winner: otherPlayerId,
              message: "Your opponent disconnected from the server. You win by forfeit!",
              reward: 25
            });
          } catch (error) {
            console.error('Error updating stats after disconnect:', error);
          }
        }
      }
    }
  }
});
});

// Helper function to get all online players
async function getOnlinePlayers() {
  try {
    const playerIds = Object.values(activePlayers);
    
    if (!playerIds || playerIds.length === 0) {
      console.log('No active players found');
      return [];
    }
    
    console.log('Active player IDs:', playerIds);
    
    // Find all users by ID
    const users = await User.find({ 
      _id: { $in: playerIds } 
    }, 'username avatar');
    
    console.log('Found users:', users.length);
    
    // Map database users to player objects with socketId
    const players = [];
    
    for (const user of users) {
      // Find the socket ID for this user
      const socketId = Object.keys(activePlayers).find(
        id => activePlayers[id].toString() === user._id.toString()
      );
      
      if (socketId) {
        // Fix avatar path if needed
        let avatarPath = user.avatar;
        if (avatarPath && !avatarPath.startsWith('images/')) {
          avatarPath = `images/${avatarPath}`;
        }
        
        players.push({
          id: socketId,
          userId: user._id.toString(),
          username: user.username,
          avatar: avatarPath,
          online: true
        });
      }
    }
    
    console.log('Returning players list:', players);
    return players;
  } catch (error) {
    console.error('Error getting online players:', error);
    return [];
  }
}

// Validate stats to prevent cheating
function validateStats(stats) {
  // Make sure all required stats are present
  if (typeof stats.strength !== 'number' || 
      typeof stats.agility !== 'number' || 
      typeof stats.intuition !== 'number' || 
      typeof stats.endurance !== 'number' ||
      typeof stats.availablePoints !== 'number') {
    return false;
  }
  
  // Make sure values are reasonable
  const minValue = 10; // Starting value
  const maxValue = 50; // Some reasonable maximum
  
  if (stats.strength < minValue || stats.strength > maxValue ||
      stats.agility < minValue || stats.agility > maxValue ||
      stats.intuition < minValue || stats.intuition > maxValue ||
      stats.endurance < minValue || stats.endurance > maxValue) {
    return false;
  }
  
  // Make sure the total points used is valid
  const totalBase = 40; // 10 x 4 stats
  const maxPoints = totalBase + 100; // Allowing for reasonable progression
  const totalPoints = stats.strength + stats.agility + stats.intuition + stats.endurance;
  
  if (totalPoints > maxPoints) {
    return false;
  }
  
  return true;
}

// Character selection API endpoint

app.post('/api/select-character', authenticate, async (req, res) => {
  try {
    const { characterClass } = req.body;
    const userId = req.user._id;
    
    // Validate character class
    const validClasses = ['shadowsteel', 'ironbound', 'flameheart', 'venomfang'];
    if (!validClasses.includes(characterClass)) {
      return res.status(400).json({ error: 'Invalid character class' });
    }
    
    // Get character bonuses
    const characterBonuses = getCharacterBonuses(characterClass);
    
    // Update user with character class
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        characterClass, 
        updatedAt: Date.now() 
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Base stats + character bonuses
    const baseStats = {
      strength: 10,
      agility: 10,
      intuition: 10,
      endurance: 10
    };
    
    // Apply character bonuses
    const updatedStats = {
      strength: baseStats.strength + characterBonuses.strength,
      agility: baseStats.agility + characterBonuses.agility,
      intuition: baseStats.intuition + characterBonuses.intuition,
      endurance: baseStats.endurance + characterBonuses.endurance,
      specialAbility: characterBonuses.specialAbility
    };
    
    // Create or update player stats
    const playerStats = await Stats.findOneAndUpdate(
      { userId },
      {
        userId,
        strength: updatedStats.strength,
        agility: updatedStats.agility,
        intuition: updatedStats.intuition,
        endurance: updatedStats.endurance,
        specialAbility: updatedStats.specialAbility,
        lastUpdated: Date.now()
      },
      { upsert: true, new: true }
    );
    
    // Send success response
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to get character bonuses
function getCharacterBonuses(characterClass) {
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
// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});