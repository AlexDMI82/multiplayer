const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  characterClass: {
    type: String,
    enum: ['shadowsteel', 'ironbound', 'flameheart', 'venomfang'],
    required: true
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 50
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  baseStats: {
    strength: { type: Number, default: 10 },
    agility: { type: Number, default: 10 },
    intuition: { type: Number, default: 10 },
    endurance: { type: Number, default: 10 }
  },
  personality: {
    aggressiveness: { type: Number, default: 0.5, min: 0, max: 1 }, // How often they attack vs defend
    predictability: { type: Number, default: 0.5, min: 0, max: 1 }, // How random their moves are
    reactionTime: { type: Number, default: 800, min: 100, max: 3000 } // Milliseconds to make a move
  },
  isBot: {
    type: Boolean,
    default: true
  },
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  },
  equipment: {
    weapon: { type: Object, default: null },
    armor: { type: Object, default: null },
    shield: { type: Object, default: null },
    helmet: { type: Object, default: null }
  },
  avatar: {
    type: String,
    default: 'bot-avatar.png'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Bot = mongoose.model('Bot', botSchema);
module.exports = Bot;