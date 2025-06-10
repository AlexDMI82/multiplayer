// FIXED: JWT authentication issues in server.js

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
const jwt = require('jsonwebtoken'); // FIXED: Changed from 'jsonwebtoken' to 'jwt' for consistency
const levelingSystem = require('./server/leveling-system');
const activeChallenges = new Map();
const userSockets = new Map();

// Create the ShopHandlers class inline
class ShopHandlers {
    constructor(io) {
        this.io = io;
        this.SHOP_DATA = {
            weapons: [
                {
                    id: 'sword_001',
                    name: 'Dark Sword',
                    type: 'weapon',
                    price: 100,
                    damage: 5,
                    rarity: 'common',
                    image: '/images/swords/DarkSword.jpg',
                    description: 'A basic iron sword, reliable and sturdy.'
                },
                {
                    id: 'sword_002',
                    name: 'Flaming Sword',
                    type: 'weapon',
                    price: 500,
                    damage: 12,
                    rarity: 'rare',
                    image: '/images/swords/FlamingSword.jpg',
                    description: 'A sword imbued with the essence of fire, burns enemies on hit.'
                },
            ],
            armor: [
                {
                    id: 'armor_001',
                    name: 'Leather Vest',
                    type: 'armor',
                    price: 150,
                    defense: 5,
                    rarity: 'common',
                    image: '/images/armor/leather.png',
                    description: 'Basic leather protection for adventurers.'
                },
                {
                    id: 'armor_002',
                    name: 'Iron Chestplate',
                    type: 'armor',
                    price: 400,
                    defense: 10,
                    rarity: 'uncommon',
                    image: '/images/armor/iron.png',
                    description: 'Solid iron protection for the torso.'
                },
            ],
            shields: [
                 {
                    id: 'shield_001',
                    name: 'Dark Shield',
                    type: 'shield',
                    price: 100,
                    defense: 3,
                    rarity: 'common',
                    image: '/images/shields/darkShield.jpg',
                    description: 'A basic dark shield providing minimal protection.'
                },
                {
                    id: 'shield_002',
                    name: 'Flame Shield',
                    type: 'shield',
                    price: 300,
                    defense: 7,
                    rarity: 'uncommon',
                    image: '/images/shields/flameShield.jpg',
                    description: 'A shield imbued with fire magic, burns attackers on contact.'
                },
            ],
             helmets: [
                {
                    id: 'helmet_001',
                    name: 'Dark Helm',
                    type: 'helmet',
                    price: 100,
                    defense: 2,
                    rarity: 'common',
                    image: '/images/helm/darHelm.jpg',
                    description: 'A basic dark helmet providing minimal head protection.'
                },
                {
                    id: 'helmet_002',
                    name: 'Fire Helm',
                    type: 'helmet',
                    price: 300,
                    defense: 5,
                    rarity: 'uncommon',
                    image: '/images/helm/fireHelm.jpg',
                    description: 'A helmet forged with fire magic, radiates warmth and protection.'
                },
            ],
        };
    }

    findItemById(itemId) {
        for (const category of Object.values(this.SHOP_DATA)) {
            const item = category.find(item => item.id === itemId);
            if (item) return item;
        }
        return null;
    }

    registerHandlers(socket) {
        console.log(`🏪 Registering shop handlers for ${socket.user.username}`);

        socket.on('getShopItems', () => {
            console.log(`📦 Sending shop items to ${socket.user.username}`);
            socket.emit('shopItems', this.SHOP_DATA);
        });

        socket.on('buyItem', async (data) => {
            try {
                console.log(`💰 Purchase request from ${socket.user.username}:`, data);
                
                const { itemId, itemType } = data;
                const item = this.findItemById(itemId);
                if (!item) {
                    console.log(`❌ Item not found: ${itemId}`);
                    socket.emit('purchaseFailed', { 
                        reason: 'Item not found',
                        message: `Item with ID ${itemId} not found in shop` 
                    });
                    return;
                }

                let inventory = await Inventory.findOne({ userId: socket.user._id });
                if (!inventory) {
                    console.log(`Creating new inventory for ${socket.user.username}`);
                    inventory = await Inventory.create({ 
                        userId: socket.user._id,
                        gold: 1000,
                        equipped: {},
                        inventory: []
                    });
                }

                if (inventory.gold < item.price) {
                    console.log(`❌ Insufficient funds for ${socket.user.username}. Has: ${inventory.gold}, Needs: ${item.price}`);
                    socket.emit('purchaseFailed', { 
                        reason: 'Insufficient funds',
                        message: `You need ${item.price} gold, but only have ${inventory.gold}` 
                    });
                    return;
                }

                const inventoryItem = {
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    image: item.image,
                    description: item.description,
                    rarity: item.rarity,
                    price: item.price
                };

                if (item.damage) inventoryItem.damage = item.damage;
                if (item.defense) inventoryItem.defense = item.defense;

                const newGold = inventory.gold - item.price;
                
                await Inventory.findOneAndUpdate(
                    { userId: socket.user._id },
                    {
                        $push: { inventory: inventoryItem },
                        $set: { gold: newGold }
                    },
                    { new: true }
                );

                console.log(`✅ Purchase successful for ${socket.user.username}: ${item.name} for ${item.price} gold. New gold: ${newGold}`);

                socket.emit('purchaseComplete', {
                    item: inventoryItem,
                    newGold: newGold,
                    itemName: item.name,
                    message: `Successfully purchased ${item.name}!`
                });

                const updatedInventory = await Inventory.findOne({ userId: socket.user._id });
                socket.emit('inventory', updatedInventory);

            } catch (error) {
                console.error('Error processing purchase:', error);
                socket.emit('purchaseFailed', { 
                    reason: 'Server error',
                    message: 'An error occurred while processing your purchase' 
                });
            }
        });

        socket.on('equipItem', async (data) => {
            try {
                console.log(`⚔️ Equip request from ${socket.user.username}:`, data);
                
                const { itemId, itemType } = data;

                const inventory = await Inventory.findOne({ userId: socket.user._id });
                if (!inventory) {
                    socket.emit('equipFailed', { message: 'Inventory not found' });
                    return;
                }

                const itemIndex = inventory.inventory.findIndex(item => item.id === itemId);
                if (itemIndex === -1) {
                    socket.emit('equipFailed', { message: 'Item not found in inventory' });
                    return;
                }

                const item = inventory.inventory[itemIndex];

                if (inventory.equipped[itemType]) {
                    inventory.inventory.push(inventory.equipped[itemType]);
                }

                inventory.equipped[itemType] = item;
                inventory.inventory.splice(itemIndex, 1);

                await inventory.save();

                console.log(`✅ Item equipped successfully for ${socket.user.username}: ${item.name}`);

                socket.emit('equipmentUpdated', {
                    equipped: inventory.equipped,
                    inventory: inventory.inventory,
                    gold: inventory.gold
                });

            } catch (error) {
                console.error('Error equipping item:', error);
                socket.emit('equipFailed', { message: 'Failed to equip item' });
            }
        });
    }
}

const shopHandlers = new ShopHandlers(io);
const BotManager = require('./server/botManager');

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' }); // FIXED: Now using 'jwt'
};

// FIXED: Authentication middleware with proper error handling
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      if (req.path.endsWith('.html') || req.path === '/profile' || req.path === '/character-select.html' || req.path === '/shop.html') {
        return res.redirect('/login.html');
      }
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET); // FIXED: Now using 'jwt'
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

const WINS_PER_LEVEL = 10;
const POINTS_PER_LEVEL = 5;

app.use(express.static('public'));
app.use(express.static(__dirname)); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function getCharacterBonuses(characterClass) {
  switch(characterClass) {
    case 'shadowsteel': return { agility: 7, strength: 3, intuition: 0, endurance: 0, specialAbility: 'evade' };
    case 'ironbound': return { agility: 0, strength: 5, intuition: 0, endurance: 5, specialAbility: 'ignoreBlock' };
    case 'flameheart': return { agility: 0, strength: 3, intuition: 7, endurance: 0, specialAbility: 'criticalHit' };
    case 'venomfang': return { agility: 5, strength: 5, intuition: 0, endurance: 0, specialAbility: 'poison' };
    default: return { agility: 0, strength: 0, intuition: 0, endurance: 0, specialAbility: null };
  }
}

const connectedPlayers = new Map();
const activeGames = new Map();
const CombatSystem = require('./combat-system-server.js');
const combatSystem = new CombatSystem();
const botManager = new BotManager(io, combatSystem);
global.connectedPlayers = connectedPlayers;

async function ensureInventoryExists(userId) {
    try {
        let inventory = await Inventory.findOne({ userId });
        
        if (!inventory) {
            console.log(`📦 Creating new inventory for user ${userId}`);
            inventory = await Inventory.create({
                userId: userId,
                gold: 1000,
                equipped: {
                    weapon: null,
                    armor: null,
                    shield: null,
                    helmet: null,
                    boots: null,
                    gloves: null,
                    amulet: null,
                    ring: null
                },
                inventory: []
            });
            console.log(`✅ New inventory created with 1000 gold`);
        } else {
            let needsSave = false;
            
            if (typeof inventory.gold !== 'number') {
                inventory.gold = 1000;
                needsSave = true;
                console.log(`🔧 Fixed gold for user ${userId}: set to 1000`);
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
                console.log(`✅ Inventory structure fixed for user ${userId}`);
            }
        }
        
        return inventory;
    } catch (error) {
        console.error(`❌ Error ensuring inventory exists for user ${userId}:`, error);
        throw error;
    }
}

mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB');
  await botManager.initializeBots();
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/character-profile.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'character-profile.html')));
app.get('/profile.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/shop.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'shop.html')));
app.get('/profile', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/character-select.html', authenticate, (req, res) => res.sendFile(path.join(__dirname, 'character-select.html')));

// FIXED: Registration endpoint with proper error handling
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

// FIXED: Login endpoint with proper error handling
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

// Character selection API endpoint 
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

// Update user profile
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

// Change password
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

// FIXED: Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('Socket Auth: No token provided for socket ID:', socket.id);
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, JWT_SECRET); // FIXED: Now using 'jwt'
    const user = await User.findById(decoded.id).select('-password'); 

    if (!user) {
      console.log('Socket Auth: User not found for token, socket ID:', socket.id);
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error(`Socket authentication error for socket ID ${socket.id}:`, error.message);
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication error: Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired'));
    }
    return next(new Error('Authentication error: Could not authenticate'));
  }
});

// FIXED: Socket connection handler
io.on('connection', async (socket) => {
  const user = socket.user;
  const userId = user._id.toString();
  console.log(`Player connected: ${user.username} (Socket ID: ${socket.id})`);

  // Track all active sockets for a user
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);
  console.log(`User ${user.username} now has ${userSockets.get(userId).size} active connections.`);
  
  // FIXED: Check if levelingSystem exists before calling it
  try {
    if (levelingSystem && typeof levelingSystem.migratePlayerData === 'function') {
      await levelingSystem.migratePlayerData(userId);
    }
  } catch (error) {
    console.error('Error migrating player data:', error);
  }

  const stats = await Stats.findOne({ userId });
  let inventory = await ensureInventoryExists(user._id);
  const playerLevel = await PlayerLevel.findOne({ userId });

  shopHandlers.registerHandlers(socket);

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

  // Send profile data to the newly connected client
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
  
  socket.on('disconnect', () => {
    const disconnectedPlayer = connectedPlayers.get(socket.id);
    if (disconnectedPlayer) {
      console.log(`Player disconnected: ${disconnectedPlayer.username} (Socket ID: ${socket.id})`);
      connectedPlayers.delete(socket.id);
      
      const userId = disconnectedPlayer.userId;
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        if (userSockets.get(userId).size === 0) {
            userSockets.delete(userId);
        }
      }
      activeChallenges.forEach((challenge, key) => {
        if (challenge.challenger === socket.id || challenge.opponent === socket.id) {
          activeChallenges.delete(key);
        }
      });
      io.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());
    }
  });
  
  socket.on('getProfile', async () => {
    try {
      const stats = await Stats.findOne({ userId: socket.user._id });
      const inventory = await ensureInventoryExists(socket.user._id);
      const playerLevel = await PlayerLevel.findOne({ userId: socket.user._id });
      
      socket.emit('profileData', {
        user: { 
          id: socket.user._id, 
          username: socket.user.username, 
          email: socket.user.email, 
          avatar: socket.user.avatar, 
          characterClass: socket.user.characterClass 
        },
        stats: stats,
        inventory: inventory,
        playerLevel: playerLevel
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  });

  // Add other socket event handlers here...
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET); // FIXED: Now using 'jwt'
      if (decoded.id === socket.user._id.toString()) {
        socket.emit('authenticated', { success: true });
      } else {
        socket.emit('authError', { message: 'Invalid token' });
      }
    } catch (error) {
      socket.emit('authError', { message: 'Authentication failed' });
    }
  });
});

// FIXED: Helper function to send profile updates
async function sendProfileUpdate(userId) {
    try {
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
        
        const sockets = userSockets.get(userId.toString());
        if (sockets && sockets.size > 0) {
            sockets.forEach(socketId => {
                io.to(socketId).emit('profileDataUpdate', fullProfileData);
            });
            console.log(`Sent profile update to ${user.username} on ${sockets.size} connections.`);
        }
    } catch(error) {
        console.error(`Error sending profile update to user ${userId}:`, error);
    }
}

// FIXED: End game function
async function endGame(gameId, winnerId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  clearTimeout(game.turnTimer);
  
  const loserId = Object.keys(game.players).find(id => id !== winnerId);

  if (winnerId && game.players[winnerId] && !winnerId.startsWith('bot_')) {
    const winner = game.players[winnerId];
    if (levelingSystem && typeof levelingSystem.processGameResult === 'function') {
      await levelingSystem.processGameResult(winner.userId, 'win');
    }
    await sendProfileUpdate(winner.userId);
  }
  
  if (loserId && game.players[loserId] && !loserId.startsWith('bot_')) {
    const loser = game.players[loserId];
    if (levelingSystem && typeof levelingSystem.processGameResult === 'function') {
      await levelingSystem.processGameResult(loser.userId, 'loss');
    }
    await sendProfileUpdate(loser.userId);
  }
  
  io.to(gameId).emit('gameOver', {
    winner: winnerId,
    loser: loserId,
    reason: 'defeat'
  });
  
  botManager.cleanupBotGame(gameId);
  activeGames.delete(gameId);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`🏪 Shop system initialized with working buy/sell functionality`);
});