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
app.use(express.json());

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

// Connect to MongoDB
mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

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

// Character selection endpoint
app.get('/character-select.html', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'character-select.html'));
});

// Registration endpoint - UPDATED WITH TRANSACTION SUPPORT
app.post('/api/register', async (req, res) => {
  // Start a session for the transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { username, email, password, avatar } = req.body;
    
    // Log the received registration data (without password)
    console.log('Registration request received:', { username, email, avatar });
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        message: existingUser.username === username 
          ? 'Username already exists' 
          : 'Email already registered' 
      });
    }
    
    console.log('Creating user...');
    // Create new user with session
    const user = new User({ username, email, password, avatar });
    await user.save({ session });
    console.log('User created successfully:', user._id.toString());
    
    // Create stats, inventory, and player level with session
    console.log('Creating stats...');
    await Stats.create([{ userId: user._id }], { session });
    console.log('Stats created successfully');
    
    console.log('Creating inventory...');
    await Inventory.create([{ userId: user._id }], { session });
    console.log('Inventory created successfully');
    
    console.log('Creating player level...');
    await PlayerLevel.create([{ userId: user._id, level: 1, wins: 0 }], { session });
    console.log('Player level created successfully');
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    console.log('Transaction committed successfully');
    
    // Generate token
    const token = generateToken(user._id);
    console.log('Token generated successfully');
    
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
    
    console.log('Sending successful response');
    res.status(201).json({ 
      message: 'Registration successful',
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: avatarPath,
        characterClass: user.characterClass || null
      },
      token
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
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
    
    // Validate character class
    const validClasses = ['shadowsteel', 'ironbound', 'flameheart', 'venomfang'];
    if (!validClasses.includes(characterClass)) {
      console.log('Invalid character class:', characterClass);
      return res.status(400).json({ error: 'Invalid character class' });
    }
    
    console.log('Selected character class:', characterClass);
    
    // Get character bonuses
    const characterBonuses = getCharacterBonuses(characterClass);
    console.log('Character bonuses:', characterBonuses);
    
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
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('User updated with character class');
    
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
    
    console.log('Updated stats:', updatedStats);
    
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
    
    console.log('Player stats updated');
    
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

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Character selection API endpoint available at: http://localhost:${PORT}/api/select-character`);
});