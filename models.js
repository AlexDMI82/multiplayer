// models.js - Database schemas and models

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: 'avatar1.png'
  },
  characterClass: {
    type: String,
    enum: ['shadowsteel', 'ironbound', 'flameheart', 'venomfang', null],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

// Updated Stats Schema with better defaults and win/loss tracking
const statsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  strength: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  agility: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  intuition: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  endurance: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  specialAbility: {
    type: String,
    enum: ['evade', 'ignoreBlock', 'criticalHit', 'poison', null],
    default: null
  },
  availablePoints: {
    type: Number,
    default: 3,
    min: 0
  },
  totalWins: {
    type: Number,
    default: 0,
    min: 0
  },
  totalLosses: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Add pre-save middleware to update the lastUpdated timestamp
statsSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Inventory Schema
const inventorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gold: {
    type: Number,
    default: 100,
    min: 0
  },
  equipped: {
    weapon: {
      type: Object,
      default: null
    },
    armor: {
      type: Object,
      default: null
    },
    shield: {
      type: Object,
      default: null
    },
    helmet: {
      type: Object,
      default: null
    }
  },
  inventory: [Object]
});

// Add pre-save hook to hash passwords
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create models
const User = mongoose.model('User', userSchema);
const Stats = mongoose.model('Stats', statsSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = { User, Stats, Inventory };