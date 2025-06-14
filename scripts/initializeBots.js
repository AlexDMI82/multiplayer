// scripts/initializeBots.js - Script to populate the database with bots
const mongoose = require('mongoose');
const Bot = require('../models/bot');

// Bot data to create
const botsData = [
  {
    username: 'ShadowStrike',
    characterClass: 'shadowsteel',
    level: 3,
    difficulty: 'easy',
    baseStats: { strength: 10, agility: 12, intuition: 8, endurance: 10 },
    personality: { aggressiveness: 0.6, predictability: 0.7, reactionTime: 1200 },
    wins: 15,
    losses: 25,
    equipment: {
      // --- FIXED PATH ---
      weapon: { id: 'sword_001', name: 'Dark Sword', damage: 5, image: '/images/swords/DarkSword.jpg' },
      armor: null,
      shield: null,
      helmet: null
    },
    avatar: 'images/characters/shadowsteel.png',
    isActive: true
  },
  {
    username: 'IronCrusher',
    characterClass: 'ironbound',
    level: 5,
    difficulty: 'medium',
    baseStats: { strength: 12, agility: 8, intuition: 9, endurance: 11 },
    personality: { aggressiveness: 0.8, predictability: 0.5, reactionTime: 900 },
    wins: 35,
    losses: 15,
    equipment: {
      // --- FIXED PATHS ---
      weapon: { id: 'sword_002', name: 'Flaming Sword', damage: 12, image: '/images/swords/FlamingSword.jpg' },
      armor: { id: 'armor_001', name: 'Leather Vest', defense: 5, image: '/images/armor/leather.png' },
      shield: { id: 'shield_001', name: 'Dark Shield', defense: 3, image: '/images/shields/darkShield.jpg' },
      helmet: null
    },
    avatar: 'images/characters/ironbound.png',
    isActive: true
  },
  {
    username: 'FlameMaster',
    characterClass: 'flameheart',
    level: 7,
    difficulty: 'hard',
    baseStats: { strength: 11, agility: 9, intuition: 13, endurance: 7 },
    personality: { aggressiveness: 0.7, predictability: 0.3, reactionTime: 600 },
    wins: 55,
    losses: 20,
    equipment: {
      // --- FIXED PATHS ---
      weapon: { id: 'sword_002', name: 'Flaming Sword', damage: 12, image: '/images/swords/FlamingSword.jpg' },
      armor: { id: 'armor_002', name: 'Iron Chestplate', defense: 10, image: '/images/armor/iron.png' },
      shield: { id: 'shield_002', name: 'Flame Shield', defense: 7, image: '/images/shields/flameShield.jpg' },
      helmet: { id: 'helmet_001', name: 'Dark Helm', defense: 2, image: '/images/helm/darHelm.jpg' }
    },
    avatar: 'images/characters/flameheart.png',
    isActive: true
  },
  {
    username: 'VenomStrike',
    characterClass: 'venomfang',
    level: 4,
    difficulty: 'medium',
    baseStats: { strength: 11, agility: 11, intuition: 8, endurance: 10 },
    personality: { aggressiveness: 0.9, predictability: 0.4, reactionTime: 800 },
    wins: 28,
    losses: 12,
    equipment: {
      // --- FIXED PATH ---
      weapon: { id: 'sword_003', name: 'Poison Sword', damage: 15, image: '/images/swords/PoisonSword.jpg' },
      armor: { id: 'armor_001', name: 'Leather Vest', defense: 5, image: '/images/armor/leather.png' },
      shield: null,
      helmet: null
    },
    avatar: 'images/characters/venomfang.png',
    isActive: true
  },
  {
    username: 'SteelGuardian',
    characterClass: 'ironbound',
    level: 8,
    difficulty: 'expert',
    baseStats: { strength: 14, agility: 7, intuition: 10, endurance: 13 },
    personality: { aggressiveness: 0.5, predictability: 0.2, reactionTime: 400 },
    wins: 75,
    losses: 10,
    equipment: {
      // --- FIXED PATHS ---
      weapon: { id: 'sword_004', name: 'Soul Sword', damage: 18, image: '/images/swords/SoulSword.jpg' },
      armor: { id: 'armor_003', name: 'Steel Plate Armor', defense: 15, image: '/images/armor/steel.png' },
      shield: { id: 'shield_003', name: 'Steel Shield', defense: 12, image: '/images/shields/steel.png' },
      helmet: { id: 'helmet_002', name: 'Fire Helm', defense: 5, image: '/images/helm/fireHelm.jpg' }
    },
    avatar: 'images/characters/ironbound.png',
    isActive: true
  },
  {
    username: 'QuickSilver',
    characterClass: 'shadowsteel',
    level: 6,
    difficulty: 'hard',
    baseStats: { strength: 9, agility: 15, intuition: 10, endurance: 8 },
    personality: { aggressiveness: 0.8, predictability: 0.3, reactionTime: 500 },
    wins: 48,
    losses: 17,
    equipment: {
      // --- FIXED PATHS ---
      weapon: { id: 'sword_005', name: 'Spectral Sword', damage: 20, image: '/images/swords/SpectralSword.jpg' },
      armor: { id: 'armor_001', name: 'Leather Vest', defense: 5, image: '/images/armor/leather.png' },
      shield: { id: 'shield_001', name: 'Dark Shield', defense: 3, image: '/images/shields/darkShield.jpg' },
      helmet: { id: 'helmet_001', name: 'Dark Helm', defense: 2, image: '/images/helm/darHelm.jpg' }
    },
    avatar: 'images/characters/shadowsteel.png',
    isActive: true
  },
  {
    username: 'Beginner Bot',
    characterClass: 'shadowsteel',
    level: 1,
    difficulty: 'easy',
    baseStats: { strength: 10, agility: 10, intuition: 10, endurance: 10 },
    personality: { aggressiveness: 0.4, predictability: 0.9, reactionTime: 2000 },
    wins: 3,
    losses: 15,
    equipment: {
      weapon: null,
      armor: null,
      shield: null,
      helmet: null
    },
    avatar: 'images/characters/shadowsteel.png',
    isActive: true
  }
];

async function initializeBots() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB');

    // Clear existing bots
    await Bot.deleteMany({});
    console.log('Cleared existing bots');

    // Create new bots
    const createdBots = await Bot.insertMany(botsData);
    console.log(`Created ${createdBots.length} bots:`);
    
    createdBots.forEach(bot => {
      console.log(`- ${bot.username} (${bot.characterClass}, Level ${bot.level}, ${bot.difficulty})`);
    });

    console.log('✅ Bot initialization complete!');
    
  } catch (error) {
    console.error('❌ Error initializing bots:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the initialization
if (require.main === module) {
  initializeBots();
}

module.exports = initializeBots;