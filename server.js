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
const activeChallenges = new Map(); // Track active challenges to prevent duplicates

// Create the ShopHandlers class inline since we don't have the directory structure
class ShopHandlers {
    constructor(io) {
        this.io = io;
        // Shop data that matches the client
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
                {
                    id: 'sword_003',
                    name: 'Poison Sword',
                    type: 'weapon',
                    price: 800,
                    damage: 15,
                    rarity: 'epic',
                    image: '/images/swords/PoisonSword.jpg',
                    description: 'A venomous blade that poisons enemies with each strike.'
                },
                {
                    id: 'sword_004',
                    name: 'Soul Sword',
                    type: 'weapon',
                    price: 1200,
                    damage: 18,
                    rarity: 'epic',
                    image: '/images/swords/SoulSword.jpg',
                    description: 'Forged in darkness, this blade drains the life force of enemies.'
                },
                {
                    id: 'sword_005',
                    name: 'Spectral Sword',
                    type: 'weapon',
                    price: 1500,
                    damage: 20,
                    rarity: 'legendary',
                    image: '/images/swords/SpectralSword.jpg',
                    description: 'A ghostly blade that phases through armor.'
                },
                {
                    id: 'sword_006',
                    name: 'Vampire Sword',
                    type: 'weapon',
                    price: 2000,
                    damage: 22,
                    rarity: 'legendary',
                    image: '/images/swords/VampireSword.jpg',
                    description: 'This cursed blade heals the wielder with each successful hit.'
                }
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
                {
                    id: 'armor_003',
                    name: 'Steel Plate Armor',
                    type: 'armor',
                    price: 800,
                    defense: 15,
                    rarity: 'rare',
                    image: '/images/armor/steel.png',
                    description: 'Heavy steel armor providing excellent protection.'
                },
                {
                    id: 'armor_004',
                    name: 'Dragon Scale Armor',
                    type: 'armor',
                    price: 1500,
                    defense: 20,
                    rarity: 'legendary',
                    image: '/images/armor/dragon.png',
                    description: 'Legendary armor crafted from ancient dragon scales.'
                }
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
                {
                    id: 'shield_003',
                    name: 'Long Shield',
                    type: 'shield',
                    price: 600,
                    defense: 12,
                    rarity: 'rare',
                    image: '/images/shields/longShield.jpg',
                    description: 'An elongated shield providing excellent coverage and protection.'
                },
                {
                    id: 'shield_004',
                    name: 'Poison Shield',
                    type: 'shield',
                    price: 800,
                    defense: 15,
                    rarity: 'epic',
                    image: '/images/shields/poisonShield.jpg',
                    description: 'A toxic shield that poisons enemies who strike it.'
                },
                {
                    id: 'shield_005',
                    name: 'Spectral Shield',
                    type: 'shield',
                    price: 1200,
                    defense: 18,
                    rarity: 'legendary',
                    image: '/images/shields/spectralShield.jpg',
                    description: 'A ghostly shield that can phase through certain attacks.'
                },
                {
                    id: 'shield_006',
                    name: 'Undead Shield',
                    type: 'shield',
                    price: 1500,
                    defense: 20,
                    rarity: 'legendary',
                    image: '/images/shields/undeadShield.jpg',
                    description: 'A cursed shield crafted from undead essence, radiates dark energy.'
                }
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
                {
                    id: 'helmet_003',
                    name: 'Poison Helm',
                    type: 'helmet',
                    price: 600,
                    defense: 8,
                    rarity: 'rare',
                    image: '/images/helm/poisonHelm.jpg',
                    description: 'A toxic helmet that creates a poisonous aura around the wearer.'
                },
                {
                    id: 'helmet_004',
                    name: 'Soul Helm',
                    type: 'helmet',
                    price: 900,
                    defense: 12,
                    rarity: 'epic',
                    image: '/images/helm/soulsHelm.jpg',
                    description: 'A cursed helmet that channels the power of trapped souls.'
                },
                {
                    id: 'helmet_005',
                    name: 'Spectral Helm',
                    type: 'helmet',
                    price: 1200,
                    defense: 15,
                    rarity: 'legendary',
                    image: '/images/helm/spectralHelm.jpg',
                    description: 'A ghostly helmet that provides ethereal protection and enhanced vision.'
                },
                {
                    id: 'helmet_006',
                    name: 'Vampire Helm',
                    type: 'helmet',
                    price: 1500,
                    defense: 18,
                    rarity: 'legendary',
                    image: '/images/helm/vampireHelm.jpg',
                    description: 'A vampiric helmet that drains enemy life force and transfers it to the wearer.'
                }
            ],
            accessories: [
                {
                    id: 'boots_001',
                    name: 'Leather Boots',
                    type: 'boots',
                    price: 80,
                    defense: 1,
                    rarity: 'common',
                    image: '/images/accessories/boots.png',
                    description: 'Comfortable leather boots for long journeys.'
                },
                {
                    id: 'boots_002',
                    name: 'Steel Boots',
                    type: 'boots',
                    price: 200,
                    defense: 3,
                    rarity: 'uncommon',
                    image: '/images/accessories/steel_boots.png',
                    description: 'Heavy steel boots with reinforced toes.'
                },
                {
                    id: 'gloves_001',
                    name: 'Leather Gloves',
                    type: 'gloves',
                    price: 60,
                    defense: 1,
                    rarity: 'common',
                    image: '/images/accessories/gloves.png',
                    description: 'Basic leather gloves for protection.'
                },
                {
                    id: 'gloves_002',
                    name: 'Steel Gauntlets',
                    type: 'gloves',
                    price: 180,
                    defense: 3,
                    rarity: 'uncommon',
                    image: '/images/accessories/gauntlets.png',
                    description: 'Reinforced steel gauntlets for protection.'
                },
                {
                    id: 'amulet_001',
                    name: 'Health Amulet',
                    type: 'amulet',
                    price: 300,
                    defense: 0,
                    rarity: 'rare',
                    image: '/images/accessories/amulet.png',
                    description: 'Mystical amulet that boosts vitality.'
                },
                {
                    id: 'ring_001',
                    name: 'Power Ring',
                    type: 'ring',
                    price: 250,
                    defense: 0,
                    rarity: 'rare',
                    image: '/images/accessories/ring.png',
                    description: 'Ring imbued with magical power.'
                }
            ]
        };
    }

    findItemById(itemId) {
        for (const category of Object.values(this.SHOP_DATA)) {
            const item = category.find(item => item.id === itemId);
            if (item) {
                return item;
            }
        }
        return null;
    }

    registerHandlers(socket) {
        console.log(`🏪 Registering shop handlers for ${socket.user.username}`);

        // Send shop items when requested
        socket.on('getShopItems', () => {
            console.log(`📦 Sending shop items to ${socket.user.username}`);
            socket.emit('shopItems', this.SHOP_DATA);
        });

        // Handle item purchase
        socket.on('buyItem', async (data) => {
            try {
                console.log(`💰 Purchase request from ${socket.user.username}:`, data);
                
                const { itemId, itemType } = data;
                
                // Find the item
                const item = this.findItemById(itemId);
                if (!item) {
                    console.log(`❌ Item not found: ${itemId}`);
                    socket.emit('purchaseFailed', { 
                        reason: 'Item not found',
                        message: `Item with ID ${itemId} not found in shop` 
                    });
                    return;
                }

                // Get player's inventory
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

                // Check if player has enough gold
                if (inventory.gold < item.price) {
                    console.log(`❌ Insufficient funds for ${socket.user.username}. Has: ${inventory.gold}, Needs: ${item.price}`);
                    socket.emit('purchaseFailed', { 
                        reason: 'Insufficient funds',
                        message: `You need ${item.price} gold, but only have ${inventory.gold}` 
                    });
                    return;
                }

                // Create inventory item
                const inventoryItem = {
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    image: item.image,
                    description: item.description,
                    rarity: item.rarity,
                    price: item.price
                };

                // Add damage or defense stats
                if (item.damage) {
                    inventoryItem.damage = item.damage;
                }
                if (item.defense) {
                    inventoryItem.defense = item.defense;
                }

                // Add item to inventory and deduct gold
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

                // Send success response
                socket.emit('purchaseComplete', {
                    item: inventoryItem,
                    newGold: newGold,
                    itemName: item.name,
                    message: `Successfully purchased ${item.name}!`
                });

                // Send updated inventory
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

        // Handle item equipping
        socket.on('equipItem', async (data) => {
            try {
                console.log(`⚔️ Equip request from ${socket.user.username}:`, data);
                
                const { itemId, itemType } = data;

                const inventory = await Inventory.findOne({ userId: socket.user._id });
                if (!inventory) {
                    socket.emit('equipFailed', { message: 'Inventory not found' });
                    return;
                }

                // Find item in inventory
                const itemIndex = inventory.inventory.findIndex(item => item.id === itemId);
                if (itemIndex === -1) {
                    socket.emit('equipFailed', { message: 'Item not found in inventory' });
                    return;
                }

                const item = inventory.inventory[itemIndex];

                // Unequip current item if any (move back to inventory)
                if (inventory.equipped[itemType]) {
                    inventory.inventory.push(inventory.equipped[itemType]);
                }

                // Equip new item
                inventory.equipped[itemType] = item;

                // Remove item from inventory
                inventory.inventory.splice(itemIndex, 1);

                // Save changes
                await inventory.save();

                console.log(`✅ Item equipped successfully for ${socket.user.username}: ${item.name}`);

                // Send updated equipment and inventory
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

// JWT Secret for token verification
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Create JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware to authenticate HTTP requests
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

// Level system constants
const WINS_PER_LEVEL = 10;
const POINTS_PER_LEVEL = 5;

// Middleware
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

// Helper function to get character bonuses
function getCharacterBonuses(characterClass) {
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

// --- Socket.IO Player List Handling ---
const connectedPlayers = new Map();
const activeGames = new Map(); // Store active game sessions

// Import combat system
const CombatSystem = require('./combat-system-server.js');
const combatSystem = new CombatSystem();

// Create bot manager instance
const botManager = new BotManager(io, combatSystem);

// Make connectedPlayers globally accessible for bot manager
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
            // Ensure existing inventory has proper structure
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


// Connect to MongoDB
mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB');
  
  // Initialize bots
  await botManager.initializeBots();
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes for authentication and registration
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

app.get('/profile', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/character-select.html', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'character-select.html'));
});

// Registration endpoint
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
    await Inventory.create([{ userId: user._id, gold: 1000 }], { session: mongoSession }); // Give new players 1000 gold
    await PlayerLevel.create([{ userId: user._id, level: 1, wins: 0 }], { session: mongoSession });
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

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    user.lastLogin = Date.now();
    await user.save();
    
    const token = generateToken(user._id);
    
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

// Logout endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
});

// Get user profile
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    
    let stats = await Stats.findOne({ userId });
    if (!stats) stats = await Stats.create({ userId });
    
    let inventory = await Inventory.findOne({ userId });
    if (!inventory) inventory = await Inventory.create({ userId, gold: 1000 });
    
    let playerLevel = await PlayerLevel.findOne({ userId });
    if (!playerLevel) playerLevel = await PlayerLevel.create({ userId, level: 1, wins: 0 });
    
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

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('Socket Auth: No token provided for socket ID:', socket.id);
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
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

io.on('connection', async (socket) => {
  const user = socket.user;
  console.log(`Player connected: ${user.username} (User ID: ${user._id}, Socket ID: ${socket.id})`);

  // Fetch player stats and inventory for game purposes
  const stats = await Stats.findOne({ userId: user._id });
  
  // FIXED: Use ensureInventoryExists instead of manual checks
  let inventory = await ensureInventoryExists(user._id);
  
  const playerLevel = await PlayerLevel.findOne({ userId: user._id });

  // Register shop handlers for this socket
  shopHandlers.registerHandlers(socket);

  const playerData = {
    socketId: socket.id,
    userId: user._id.toString(),
    username: user.username,
    avatar: user.avatar,
    characterClass: user.characterClass || 'unselected',
    stats: stats,
    inventory: inventory,
    level: playerLevel ? playerLevel.level : 1
  };

  connectedPlayers.set(socket.id, playerData);

  // Broadcast the updated player list INCLUDING BOTS to ALL connected clients
  io.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());
  console.log(`Player list updated. Current players: ${Array.from(connectedPlayers.values()).map(p=>p.username).join(', ')}`);

  // Send profile data to the connected player - INCLUDE INVENTORY
  socket.emit('profileData', {
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      characterClass: user.characterClass
    },
    stats: stats ? {
      strength: stats.strength,
      agility: stats.agility,
      intuition: stats.intuition,
      endurance: stats.endurance,
      availablePoints: stats.availablePoints || 0,
      totalWins: stats.totalWins || 0,
      totalLosses: stats.totalLosses || 0
    } : null,
    inventory: inventory, // CRITICAL: Include inventory in profile data
    level: playerLevel ? playerLevel.level : 1,
    wins: playerLevel ? playerLevel.wins : 0
  });

  // ALSO send inventory separately to ensure client gets it
  socket.emit('inventory', inventory);
  console.log(`💰 User ${user.username} has ${inventory.gold} gold`);

  // Handle authenticate event from client
  socket.on('authenticate', async (token) => {
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.id === socket.user._id.toString()) {
        socket.emit('authenticated', { success: true });
      } else {
        socket.emit('authError', { message: 'Invalid token' });
      }
    } catch (error) {
      socket.emit('authError', { message: 'Authentication failed' });
    }
  });

  // Add this right after your socket.on('authenticate') handler in server.js

// Replace your getShopItems handler in server.js with this complete version:

socket.on('getShopItems', () => {
  console.log(`📦 Shop items requested by ${socket.user.username}`);
  
  // Send COMPLETE shop data
  const COMPLETE_SHOP_DATA = {
    weapons: [
      {
        id: 'sword_001', name: 'Dark Sword', type: 'weapon', price: 100, damage: 5, rarity: 'common',
        image: '/images/swords/DarkSword.jpg', description: 'A basic iron sword, reliable and sturdy.'
      },
      {
        id: 'sword_002', name: 'Flaming Sword', type: 'weapon', price: 500, damage: 12, rarity: 'rare',
        image: '/images/swords/FlamingSword.jpg', description: 'A sword imbued with the essence of fire, burns enemies on hit.'
      },
      {
        id: 'sword_003', name: 'Poison Sword', type: 'weapon', price: 800, damage: 15, rarity: 'epic',
        image: '/images/swords/PoisonSword.jpg', description: 'A venomous blade that poisons enemies with each strike.'
      },
      {
        id: 'sword_004', name: 'Soul Sword', type: 'weapon', price: 1200, damage: 18, rarity: 'epic',
        image: '/images/swords/SoulSword.jpg', description: 'Forged in darkness, this blade drains the life force of enemies.'
      },
      {
        id: 'sword_005', name: 'Spectral Sword', type: 'weapon', price: 1500, damage: 20, rarity: 'legendary',
        image: '/images/swords/SpectralSword.jpg', description: 'A ghostly blade that phases through armor.'
      },
      {
        id: 'sword_006', name: 'Vampire Sword', type: 'weapon', price: 2000, damage: 22, rarity: 'legendary',
        image: '/images/swords/VampireSword.jpg', description: 'This cursed blade heals the wielder with each successful hit.'
      }
    ],
    armor: [
      {
        id: 'armor_001', name: 'Leather Vest', type: 'armor', price: 150, defense: 5, rarity: 'common',
        image: '/images/armor/leather.png', description: 'Basic leather protection for adventurers.'
      },
      {
        id: 'armor_002', name: 'Iron Chestplate', type: 'armor', price: 400, defense: 10, rarity: 'uncommon',
        image: '/images/armor/iron.png', description: 'Solid iron protection for the torso.'
      },
      {
        id: 'armor_003', name: 'Steel Plate Armor', type: 'armor', price: 800, defense: 15, rarity: 'rare',
        image: '/images/armor/steel.png', description: 'Heavy steel armor providing excellent protection.'
      },
      {
        id: 'armor_004', name: 'Dragon Scale Armor', type: 'armor', price: 1500, defense: 20, rarity: 'legendary',
        image: '/images/armor/dragon.png', description: 'Legendary armor crafted from ancient dragon scales.'
      }
    ],
    shields: [
      {
        id: 'shield_001', name: 'Dark Shield', type: 'shield', price: 100, defense: 3, rarity: 'common',
        image: '/images/shields/darkShield.jpg', description: 'A basic dark shield providing minimal protection.'
      },
      {
        id: 'shield_002', name: 'Flame Shield', type: 'shield', price: 300, defense: 7, rarity: 'uncommon',
        image: '/images/shields/flameShield.jpg', description: 'A shield imbued with fire magic, burns attackers on contact.'
      },
      {
        id: 'shield_003', name: 'Long Shield', type: 'shield', price: 600, defense: 12, rarity: 'rare',
        image: '/images/shields/longShield.jpg', description: 'An elongated shield providing excellent coverage and protection.'
      },
      {
        id: 'shield_004', name: 'Poison Shield', type: 'shield', price: 800, defense: 15, rarity: 'epic',
        image: '/images/shields/poisonShield.jpg', description: 'A toxic shield that poisons enemies who strike it.'
      },
      {
        id: 'shield_005', name: 'Spectral Shield', type: 'shield', price: 1200, defense: 18, rarity: 'legendary',
        image: '/images/shields/spectralShield.jpg', description: 'A ghostly shield that can phase through certain attacks.'
      },
      {
        id: 'shield_006', name: 'Undead Shield', type: 'shield', price: 1500, defense: 20, rarity: 'legendary',
        image: '/images/shields/undeadShield.jpg', description: 'A cursed shield crafted from undead essence, radiates dark energy.'
      }
    ],
    helmets: [
      {
        id: 'helmet_001', name: 'Dark Helm', type: 'helmet', price: 100, defense: 2, rarity: 'common',
        image: '/images/helm/darHelm.jpg', description: 'A basic dark helmet providing minimal head protection.'
      },
      {
        id: 'helmet_002', name: 'Fire Helm', type: 'helmet', price: 300, defense: 5, rarity: 'uncommon',
        image: '/images/helm/fireHelm.jpg', description: 'A helmet forged with fire magic, radiates warmth and protection.'
      },
      {
        id: 'helmet_003', name: 'Poison Helm', type: 'helmet', price: 600, defense: 8, rarity: 'rare',
        image: '/images/helm/poisonHelm.jpg', description: 'A toxic helmet that creates a poisonous aura around the wearer.'
      },
      {
        id: 'helmet_004', name: 'Soul Helm', type: 'helmet', price: 900, defense: 12, rarity: 'epic',
        image: '/images/helm/soulsHelm.jpg', description: 'A cursed helmet that channels the power of trapped souls.'
      },
      {
        id: 'helmet_005', name: 'Spectral Helm', type: 'helmet', price: 1200, defense: 15, rarity: 'legendary',
        image: '/images/helm/spectralHelm.jpg', description: 'A ghostly helmet that provides ethereal protection and enhanced vision.'
      },
      {
        id: 'helmet_006', name: 'Vampire Helm', type: 'helmet', price: 1500, defense: 18, rarity: 'legendary',
        image: '/images/helm/vampireHelm.jpg', description: 'A vampiric helmet that drains enemy life force and transfers it to the wearer.'
      }
    ],
    accessories: [
      {
        id: 'boots_001', name: 'Leather Boots', type: 'boots', price: 80, defense: 1, rarity: 'common',
        image: '/images/accessories/boots.png', description: 'Comfortable leather boots for long journeys.'
      },
      {
        id: 'boots_002', name: 'Steel Boots', type: 'boots', price: 200, defense: 3, rarity: 'uncommon',
        image: '/images/accessories/steel_boots.png', description: 'Heavy steel boots with reinforced toes.'
      },
      {
        id: 'gloves_001', name: 'Leather Gloves', type: 'gloves', price: 60, defense: 1, rarity: 'common',
        image: '/images/accessories/gloves.png', description: 'Basic leather gloves for protection.'
      },
      {
        id: 'gloves_002', name: 'Steel Gauntlets', type: 'gloves', price: 180, defense: 3, rarity: 'uncommon',
        image: '/images/accessories/gauntlets.png', description: 'Reinforced steel gauntlets for protection.'
      },
      {
        id: 'amulet_001', name: 'Health Amulet', type: 'amulet', price: 300, defense: 0, rarity: 'rare',
        image: '/images/accessories/amulet.png', description: 'Mystical amulet that boosts vitality.'
      },
      {
        id: 'ring_001', name: 'Power Ring', type: 'ring', price: 250, defense: 0, rarity: 'rare',
        image: '/images/accessories/ring.png', description: 'Ring imbued with magical power.'
      }
    ]
  };
  
  socket.emit('shopItems', COMPLETE_SHOP_DATA);
  console.log(`✅ Complete shop data sent to ${socket.user.username} - ${Object.keys(COMPLETE_SHOP_DATA.weapons).length} weapons, ${Object.keys(COMPLETE_SHOP_DATA.armor).length} armor, ${Object.keys(COMPLETE_SHOP_DATA.shields).length} shields, ${Object.keys(COMPLETE_SHOP_DATA.helmets).length} helmets, ${Object.keys(COMPLETE_SHOP_DATA.accessories).length} accessories`);
});

  // FIXED: Handle getProfile request with ensureInventoryExists
  socket.on('getProfile', async () => {
    try {
      const stats = await Stats.findOne({ userId: socket.user._id });
      const inventory = await ensureInventoryExists(socket.user._id); // FIXED
      const playerLevel = await PlayerLevel.findOne({ userId: socket.user._id });
      
      socket.emit('profileData', {
        user: {
          id: socket.user._id,
          username: socket.user.username,
          email: socket.user.email,
          avatar: socket.user.avatar,
          characterClass: socket.user.characterClass
        },
        stats: stats ? {
          strength: stats.strength,
          agility: stats.agility,
          intuition: stats.intuition,
          endurance: stats.endurance,
          availablePoints: stats.availablePoints || 0,
          totalWins: stats.totalWins || 0,
          totalLosses: stats.totalLosses || 0
        } : null,
        inventory: inventory, // Always include inventory
        level: playerLevel ? playerLevel.level : 1,
        wins: playerLevel ? playerLevel.wins : 0
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  });

  socket.on('disconnect', () => {
    const disconnectedPlayer = connectedPlayers.get(socket.id);
    if (disconnectedPlayer) {
      console.log(`Player disconnected: ${disconnectedPlayer.username} (User ID: ${disconnectedPlayer.userId}, Socket ID: ${socket.id})`);
      connectedPlayers.delete(socket.id);
      
      // Clean up any active challenges involving this player
      activeChallenges.forEach((challenge, key) => {
        if (challenge.challenger === socket.id || challenge.opponent === socket.id) {
          activeChallenges.delete(key);
        }
      });
      
      // Update player list INCLUDING BOTS
      io.emit('updatePlayerList', botManager.getAllPlayersIncludingBots());
      console.log(`Player list updated after disconnect. Current players: ${Array.from(connectedPlayers.values()).map(p=>p.username).join(', ')}`);
    } else {
      console.log(`Socket ${socket.id} disconnected (User: ${user ? user.username : 'unknown/unauthenticated'}) but was not in connectedPlayers list.`);
    }
  });

  // --- Challenge System ---
  socket.on('challengePlayer', (opponentSocketId) => {
    console.log(`Challenge request from ${socket.user.username} (${socket.id}) to player with socketId: ${opponentSocketId}`);
    
    // Check if opponent is a bot
    if (opponentSocketId.startsWith('bot_')) {
      const challengeId = `challenge_${Date.now()}_${socket.id.substring(0, 5)}`;
      const challengeData = {
        id: challengeId,
        challenger: {
          socketId: socket.id,
          userId: socket.user._id.toString(),
          username: socket.user.username,
          avatar: socket.user.avatar,
          characterClass: socket.user.characterClass || 'unselected'
        }
      };
      
      // Handle bot challenge
      botManager.handleBotChallenge(socket.id, opponentSocketId, challengeData);
      
      // Send challenge sent confirmation
      const bot = botManager.activeBots.get(opponentSocketId);
      if (bot) {
        socket.emit('challengeSent', {
          id: challengeId,
          opponentName: bot.username,
          opponentId: opponentSocketId,
          timestamp: Date.now()
        });
      }
      return;
    }
    
    // Regular player challenge logic
    const challenger = connectedPlayers.get(socket.id);
    const opponent = connectedPlayers.get(opponentSocketId);
    
    if (!challenger || !opponent) {
      console.log('Challenge failed: Challenger or opponent not found in connected players');
      socket.emit('challengeFailed', { message: 'Player not found or disconnected' });
      return;
    }
    
    // Check if there's already an active challenge between these players
    const existingChallengeKey = `${socket.id}-${opponentSocketId}`;
    const reverseChallengeKey = `${opponentSocketId}-${socket.id}`;
    
    if (activeChallenges.has(existingChallengeKey)) {
      console.log('Challenge already exists between these players');
      socket.emit('challengeFailed', { message: 'You already have a pending challenge with this player' });
      return;
    }
    
    if (activeChallenges.has(reverseChallengeKey)) {
      console.log('Opponent already challenged you');
      socket.emit('challengeFailed', { message: 'This player has already challenged you. Check your incoming challenges.' });
      return;
    }
    
    const challengeId = `challenge_${Date.now()}_${socket.id.substring(0, 5)}`;
    
    // Store the challenge to prevent duplicates
    activeChallenges.set(existingChallengeKey, {
      id: challengeId,
      challenger: socket.id,
      opponent: opponentSocketId,
      timestamp: Date.now()
    });
    
    // Set a timeout to clean up the challenge after 60 seconds
    setTimeout(() => {
      activeChallenges.delete(existingChallengeKey);
    }, 60000);
    
    const challengeData = {
      id: challengeId,
      challenger: {
        socketId: socket.id,
        userId: challenger.userId,
        username: challenger.username,
        avatar: challenger.avatar,
        characterClass: challenger.characterClass || 'unselected'
      },
      timestamp: Date.now()
    };
    
    console.log(`Sending challengeReceived event to ${opponent.username} (${opponentSocketId})`);
    console.log('Challenge data:', JSON.stringify(challengeData));
    
    // Send the challenge to the opponent ONLY ONCE
    io.to(opponentSocketId).emit('challengeReceived', challengeData);
    
    // Confirmation to the challenger ONLY ONCE
    socket.emit('challengeSent', {
      id: challengeId,
      opponentName: opponent.username,
      opponentId: opponentSocketId,
      timestamp: Date.now()
    });
  });

  socket.on('respondToChallenge', async (data) => {
    const { challengeId, accepted, challengerId } = data;
    console.log(`Challenge response from ${socket.user.username}: ${accepted ? 'accepted' : 'declined'} for challenge ${challengeId}`);
    
    const challengeKey = `${challengerId}-${socket.id}`;
    activeChallenges.delete(challengeKey);
    
    const challenger = connectedPlayers.get(challengerId);
    if (!challenger) {
        console.log('Challenge response failed: Challenger not found in connected players');
        socket.emit('challengeError', { message: 'Challenger disconnected' });
        return;
    }
    
   if (accepted) {
        const gameId = `game_${Date.now()}_${socket.id.substring(0, 5)}_${challengerId.substring(0, 5)}`;
        
        // Get full stats and inventory for both players
        const challengerStats = await Stats.findOne({ userId: challenger.userId });
        const challengerInventory = await Inventory.findOne({ userId: challenger.userId });
        const accepterStats = await Stats.findOne({ userId: socket.user._id });
        const accepterInventory = await Inventory.findOne({ userId: socket.user._id });

       // This payload is for the CHALLENGER. It must contain the ACCEPTER's info as the opponent.
        const gameDataForChallenger = {
            gameId,
            opponent: {
                id: socket.id,
                userId: socket.user._id,
                username: socket.user.username,
                avatar: socket.user.avatar,
                characterClass: socket.user.characterClass || 'unselected',
                stats: accepterStats ? {
                    strength: accepterStats.strength,
                    agility: accepterStats.agility,
                    intuition: accepterStats.intuition,
                    endurance: accepterStats.endurance
                } : { strength: 10, agility: 10, intuition: 10, endurance: 10 },
                equipment: accepterInventory ? accepterInventory.equipped : {}
            }
        };

       // This payload is for the ACCEPTER. It must contain the CHALLENGER's info as the opponent.
        const gameDataForAccepter = {
            gameId,
            opponent: {
                id: challengerId,
                userId: challenger.userId,
                username: challenger.username,
                avatar: challenger.avatar,
                characterClass: challenger.characterClass || 'unselected',
                stats: challengerStats ? {
                    strength: challengerStats.strength,
                    agility: challengerStats.agility,
                    intuition: challengerStats.intuition,
                    endurance: challengerStats.endurance
                } : { strength: 10, agility: 10, intuition: 10, endurance: 10 },
                equipment: challengerInventory ? challengerInventory.equipped : {}
            }
        };
        
         io.to(challengerId).emit('challengeAccepted', gameDataForChallenger); 
        // Send the challenger's data TO the accepter
        socket.emit('challengeAccepted', gameDataForAccepter);
        
        console.log(`Game session created: ${gameId} between ${challenger.username} and ${socket.user.username}`);
    } else {
        io.to(challengerId).emit('challengeRejected', {
            message: `${socket.user.username} declined your challenge`,
            challengeId
        });
        
        console.log(`Challenge ${challengeId} was declined by ${socket.user.username}`);
    }
  });

  socket.on('getChallengerStats', async (userId, callback) => {
    try {
      console.log(`Getting challenger stats for user: ${userId}`);
      
      // Check if it's a bot
      const botSocketId = userId.startsWith('bot_') ? userId : null;
      if (botSocketId) {
        const bot = botManager.activeBots.get(botSocketId);
        if (bot) {
          const botStats = await Stats.findOne({ userId: bot.userId });
          const botPlayerLevel = await PlayerLevel.findOne({ userId: bot.userId });
          const botInventory = await Inventory.findOne({ userId: bot.userId });
          
          const challengerData = {
            username: bot.username,
            characterClass: bot.characterClass || 'unselected',
            level: botPlayerLevel ? botPlayerLevel.level : bot.level || 1,
            stats: {
              strength: botStats ? botStats.strength : 10,
              agility: botStats ? botStats.agility : 10,
              intuition: botStats ? botStats.intuition : 10,
              endurance: botStats ? botStats.endurance : 10,
              totalWins: botStats ? botStats.totalWins : 0,
              totalLosses: botStats ? botStats.totalLosses : 0
            },
            equipment: botInventory ? botInventory.equipped : {},
            isBot: true
          };
          
          console.log('Sending bot challenger data:', challengerData);
          return callback(challengerData);
        }
      }
      
      // Regular user logic
      const user = await User.findById(userId);
      if (!user) {
        console.log('User not found for stats');
        return callback({ error: 'User not found' });
      }
      
      // Fetch stats
      const stats = await Stats.findOne({ userId });
      const playerLevel = await PlayerLevel.findOne({ userId });
      const inventory = await Inventory.findOne({ userId });
      
      // Prepare challenger data
      const challengerData = {
        username: user.username,
        characterClass: user.characterClass || 'unselected',
        level: playerLevel ? playerLevel.level : 1,
        stats: {
          strength: stats ? stats.strength : 10,
          agility: stats ? stats.agility : 10,
          intuition: stats ? stats.intuition : 10,
          endurance: stats ? stats.endurance : 10,
          totalWins: stats ? stats.totalWins : 0,
          totalLosses: stats ? stats.totalLosses : 0
        },
        equipment: inventory ? inventory.equipped : {}
      };
      
      console.log('Sending challenger data:', challengerData);
      callback(challengerData);
    } catch (error) {
      console.error('Error fetching challenger stats:', error);
      callback({ error: 'Failed to fetch stats' });
    }
  });

  // --- Game Logic ---
  socket.on('joinGame', async (gameId) => {
    console.log(`Player ${socket.user.username} joining game ${gameId}`);
    
    let game = activeGames.get(gameId);
    
    if (!game) {
      // Create new game
      game = {
        id: gameId,
        players: {},
        currentRound: null,
        status: 'waiting',
        turnTimer: null
      };
      activeGames.set(gameId, game);
    }
    
    // Add player to game
    const playerData = connectedPlayers.get(socket.id);
    const stats = await Stats.findOne({ userId: socket.user._id });
    
    // FIXED: Use ensureInventoryExists instead of manual check
    let inventory = await ensureInventoryExists(socket.user._id);

    // Calculate health with endurance bonus
    const baseHealth = 200; // New base health (changed from 100)
    const endurance = stats ? stats.endurance : 10;
    const enduranceBonus = endurance * 10; // 10 HP per endurance point
    const totalMaxHealth = baseHealth + enduranceBonus;
        
    game.players[socket.id] = {
      socketId: socket.id,
      userId: socket.user._id.toString(),
      username: socket.user.username,
      avatar: socket.user.avatar,
      characterClass: socket.user.characterClass,
      health: totalMaxHealth,           // ← Use calculated health
      maxHealth: totalMaxHealth,        // ← Use calculated health
      energy: 100,
      maxEnergy: 100,
      stats: stats ? {
        strength: stats.strength,
        agility: stats.agility,
        intuition: stats.intuition,
        endurance: stats.endurance
      } : { strength: 10, agility: 10, intuition: 10, endurance: 10 },
      specialAbility: stats ? stats.specialAbility : null,
      equipment: inventory ? inventory.equipped : {},
      damageBonus: stats ? stats.strength * 2 : 20,
      evasionChance: stats ? stats.agility : 10,
      criticalChance: stats ? stats.intuition : 10,
      enemyEvasionReduction: stats ? Math.floor(stats.intuition / 2) : 5
    };
    
    socket.join(gameId);
    
    // Check if this is a bot game
    const botGame = botManager.botGames.get(gameId);
    if (botGame) {
      await botManager.handleBotJoinGame(gameId, game);
    }
    
    // Check if game is ready to start
    if (Object.keys(game.players).length === 2) {
      game.status = 'active';
      io.to(gameId).emit('gameStarted', {
        gameId: gameId,
        gameState: {
          players: game.players,
          currentRound: 1,
          waitingForPlayers: false
        }
      });
      
      // Start first round
      startNewRound(gameId);
    } else {
      socket.emit('gameStarted', {
        gameId: gameId,
        gameState: {
          players: game.players,
          currentRound: null,
          waitingForPlayers: true
        }
      });
    }
  });

  socket.on('makeMove', (data) => {
    const { gameId, attackArea, blockArea } = data;
    console.log(`Move received from ${socket.user.username}:`, { gameId, attackArea, blockArea });
    
    const game = activeGames.get(gameId);
    if (!game) {
      socket.emit('invalidMove', { message: 'Game not found' });
      return;
    }
    
    if (!game.currentRound) {
      socket.emit('invalidMove', { message: 'No active round' });
      return;
    }
    
    // Store the move
    game.currentRound.moves[socket.id] = {
      attackArea: attackArea,
      blockArea: blockArea,
      timestamp: Date.now()
    };
    
    console.log('Current moves:', game.currentRound.moves);
    console.log('Total players:', Object.keys(game.players).length);
    console.log('Total moves:', Object.keys(game.currentRound.moves).length);
    
    socket.emit('moveReceived', { success: true });
    
    // Notify opponent
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    if (opponentId) {
      io.to(opponentId).emit('opponentMadeMove');
    }
    
    // Check if all players have made their moves
    if (Object.keys(game.currentRound.moves).length === Object.keys(game.players).length) {
      console.log('All moves received, processing round');
      clearTimeout(game.turnTimer);
      io.to(gameId).emit('allMovesMade');
      processRound(gameId);
    }
  });

  socket.on('leaveGame', (gameId) => {
    const game = activeGames.get(gameId);
    if (game && game.players[socket.id]) {
      delete game.players[socket.id];
      socket.leave(gameId);
      
      const remainingPlayers = Object.keys(game.players);
      if (remainingPlayers.length === 0) {
        activeGames.delete(gameId);
      } else {
        io.to(remainingPlayers[0]).emit('opponentLeft', {
          message: 'Your opponent has left the game'
        });
      }
    }
  });

  // FIXED: getInventory handler with enhanced error handling
  socket.on('getInventory', async () => {
    try {
      const inventory = await ensureInventoryExists(socket.user._id);
      console.log(`📦 Sending inventory to ${socket.user.username}: ${inventory.gold} gold`);
      socket.emit('inventory', inventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      socket.emit('inventory', { gold: 1000, equipped: {}, inventory: [] }); // Fallback
    }
  });

  socket.on('updateStat', async (data) => {
    try {
      const { statType } = data;
      console.log(`Updating ${statType} for ${socket.user.username}`);
      
      // Validate stat type
      const validStats = ['strength', 'agility', 'intuition', 'endurance'];
      if (!validStats.includes(statType)) {
        socket.emit('statsUpdateFailed', { message: 'Invalid stat type' });
        return;
      }
      
      // Get current stats
      let stats = await Stats.findOne({ userId: socket.user._id });
      if (!stats) {
        // Create stats if they don't exist
        stats = await Stats.create({
          userId: socket.user._id,
          strength: 10,
          agility: 10,
          intuition: 10,
          endurance: 10,
          availablePoints: 0
        });
      }
      
      // Check if user has available points
      if (!stats.availablePoints || stats.availablePoints <= 0) {
        socket.emit('statsUpdateFailed', { message: 'No available points' });
        return;
      }
      
      // Update the stat using findOneAndUpdate with proper options
      const updatedStats = await Stats.findOneAndUpdate(
        { userId: socket.user._id },
        {
          $inc: {
            [statType]: 1,
            availablePoints: -1
          },
          $set: {
            lastUpdated: Date.now()
          }
        },
        { 
          new: true,  // Return the updated document
          upsert: false  // Don't create if doesn't exist
        }
      );
      
      if (!updatedStats) {
        socket.emit('statsUpdateFailed', { message: 'Failed to update stats' });
        return;
      }
      
      console.log(`${statType} increased to ${updatedStats[statType]} for ${socket.user.username}`);
      
      // Send the complete updated stats back
      socket.emit('statUpdated', {
        stats: {
          strength: updatedStats.strength,
          agility: updatedStats.agility,
          intuition: updatedStats.intuition,
          endurance: updatedStats.endurance,
          availablePoints: updatedStats.availablePoints,
          totalWins: updatedStats.totalWins || 0,
          totalLosses: updatedStats.totalLosses || 0
        }
      });
      
      // Also emit a general stats update
      socket.emit('statsUpdate', {
        strength: updatedStats.strength,
        agility: updatedStats.agility,
        intuition: updatedStats.intuition,
        endurance: updatedStats.endurance,
        availablePoints: updatedStats.availablePoints,
        totalWins: updatedStats.totalWins || 0,
        totalLosses: updatedStats.totalLosses || 0
      });
      
      // Update connected player data
      const playerData = connectedPlayers.get(socket.id);
      if (playerData) {
        playerData.stats = updatedStats;
        connectedPlayers.set(socket.id, playerData);
      }
    } catch (error) {
      console.error('Error updating stat:', error);
      socket.emit('statsUpdateFailed', { message: 'Failed to update stat' });
    }
  });

  socket.on('requestStats', async () => {
    try {
      const stats = await Stats.findOne({ userId: socket.user._id });
      if (stats) {
        socket.emit('statsUpdate', {
          strength: stats.strength,
          agility: stats.agility,
          intuition: stats.intuition,
          endurance: stats.endurance,
          availablePoints: stats.availablePoints || 0,
          totalWins: stats.totalWins || 0,
          totalLosses: stats.totalLosses || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  });
});

// Game helper functions
function startNewRound(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  const roundNumber = game.currentRound ? game.currentRound.number + 1 : 1;
  
  game.currentRound = {
    number: roundNumber,
    moves: {},
    startTime: Date.now()
  };
  
  io.to(gameId).emit('roundStarted', {
    round: roundNumber,
    turnTime: 30
  });
  
  // Check if this game has a bot
  const botGame = botManager.botGames.get(gameId);
  if (botGame) {
    botManager.generateBotMove(gameId, game, roundNumber);
  }
  
  // Set turn timer
  game.turnTimer = setTimeout(() => {
    processTurnTimeout(gameId);
  }, 30000);
}

function processTurnTimeout(gameId) {
  const game = activeGames.get(gameId);
  if (!game || !game.currentRound) return;
  
  // Auto-submit for players who haven't moved
  Object.keys(game.players).forEach(playerId => {
    if (!game.currentRound.moves[playerId]) {
      game.currentRound.moves[playerId] = {
        attackArea: null,
        blockArea: null,
        auto: true
      };
      io.to(playerId).emit('playerSkippedTurn', { playerId });
    }
  });
  
  io.to(gameId).emit('allMovesMade');
  processRound(gameId);
}

function processRound(gameId) {
  const game = activeGames.get(gameId);
  if (!game || !game.currentRound) return;
  
  console.log('Processing round', game.currentRound.number);
  
  // Process combat
  const roundResult = combatSystem.processRound(game.players, game.currentRound.moves);
  
  // Send round results
  io.to(gameId).emit('roundResult', {
    round: game.currentRound.number,
    moves: game.currentRound.moves,
    damageDealt: roundResult.damageDealt,
    combatLog: roundResult.combatLog,
    gameState: {
      players: game.players,
      currentRound: game.currentRound.number
    }
  });
  
  // Check if game is over
  if (roundResult.gameOver) {
    endGame(gameId, roundResult.winner);
  } else {
    // Start new round after delay
    setTimeout(() => {
      startNewRound(gameId);
    }, 3000);
  }
}

async function endGame(gameId, winnerId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  clearTimeout(game.turnTimer);
  
  // Update winner stats
  if (winnerId && game.players[winnerId]) {
    const winner = game.players[winnerId];
    
    // Check if winner is a bot
    if (!winnerId.startsWith('bot_')) {
      try {
        // Update wins
        await PlayerLevel.findOneAndUpdate(
          { userId: winner.userId },
          { $inc: { wins: 1 } },
          { upsert: true }
        );
        
        // Update stats
        await Stats.findOneAndUpdate(
          { userId: winner.userId },
          { $inc: { totalWins: 1 } },
          { upsert: true }
        );
        
        // Check for level up
        const playerLevel = await PlayerLevel.findOne({ userId: winner.userId });
        if (playerLevel && playerLevel.wins % WINS_PER_LEVEL === 0) {
          const newLevel = Math.floor(playerLevel.wins / WINS_PER_LEVEL) + 1;
          await PlayerLevel.findOneAndUpdate(
            { userId: winner.userId },
            { level: newLevel }
          );
          
          // Award stat point
          await Stats.findOneAndUpdate(
            { userId: winner.userId },
            { $inc: { availablePoints: 1 } }
          );
          
          io.to(winnerId).emit('levelUp', { newLevel });
          io.to(winnerId).emit('statPointAwarded', { availablePoints: 1 });
        }
      } catch (error) {
        console.error('Error updating winner stats:', error);
      }
    }
  }
  
  // Update loser stats
  const loserId = Object.keys(game.players).find(id => id !== winnerId);
  if (loserId && game.players[loserId]) {
    // Check if loser is a bot
    if (!loserId.startsWith('bot_')) {
      try {
        await Stats.findOneAndUpdate(
          { userId: game.players[loserId].userId },
          { $inc: { totalLosses: 1 } },
          { upsert: true }
        );
      } catch (error) {
        console.error('Error updating loser stats:', error);
      }
    }
  }
  
  // Send game over event
  io.to(gameId).emit('gameOver', {
    winner: winnerId,
    loser: loserId,
    reason: 'defeat'
  });
  
  // Clean up bot game data
  botManager.cleanupBotGame(gameId);
  
  // Clean up game
  activeGames.delete(gameId);
}


async function fixAllUserGold() {
    try {
        console.log('🔧 Checking and fixing user gold amounts...');
        
        // Find all inventories with gold less than 1000
        const lowGoldInventories = await Inventory.find({ gold: { $lt: 1000 } });
        
        console.log(`Found ${lowGoldInventories.length} users with less than 1000 gold`);
        
        for (const inventory of lowGoldInventories) {
            const oldGold = inventory.gold;
            inventory.gold = 1000;
            await inventory.save();
            
            const user = await User.findById(inventory.userId);
            console.log(`💰 Updated ${user?.username || 'Unknown'} gold: ${oldGold} → 1000`);
        }
        
        // Also ensure all users have an inventory
        const usersWithoutInventory = await User.find({
            _id: { $nin: await Inventory.distinct('userId') }
        });
        
        console.log(`Found ${usersWithoutInventory.length} users without inventory`);
        
        for (const user of usersWithoutInventory) {
            await Inventory.create({
                userId: user._id,
                gold: 1000,
                equipped: {},
                inventory: []
            });
            console.log(`📦 Created inventory for ${user.username} with 1000 gold`);
        }
        
        console.log('✅ All user gold amounts fixed!');
        
    } catch (error) {
        console.error('❌ Error fixing user gold:', error);
    }
}





// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Character selection API endpoint available at: http://localhost:${PORT}/api/select-character`);
  console.log(`🏪 Shop system initialized with working buy/sell functionality`);
});