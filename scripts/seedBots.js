const mongoose = require('mongoose');
const Bot = require('../models/bot');

// Bot name templates
const botNames = {
  shadowsteel: ['NightBlade', 'ShadowFang', 'DarkAssassin', 'PhantomStrike', 'VoidWalker'],
  ironbound: ['IronCrusher', 'SteelTitan', 'MetalGuard', 'IronFist', 'Juggernaut'],
  flameheart: ['FireBlade', 'InfernoKnight', 'BlazeWarrior', 'PhoenixRage', 'EmberFury'],
  venomfang: ['ToxicFang', 'PoisonStrike', 'VenomLord', 'SerpentBite', 'AcidClaw']
};

const difficulties = ['easy', 'medium', 'hard', 'expert'];

async function seedBots(count = 20) {
  try {
    // Connect to MongoDB - removed deprecated options
    await mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0');

    console.log('Connected to MongoDB');

    // Clear existing bots
    await Bot.deleteMany({});
    console.log('Cleared existing bots');

    const bots = [];
    const classes = Object.keys(botNames);

    for (let i = 0; i < count; i++) {
      const characterClass = classes[i % classes.length];
      const nameList = botNames[characterClass];
      const baseName = nameList[Math.floor(Math.random() * nameList.length)];
      // 50% chance for level 1, 50% chance for random level 2-20
      const level = Math.random() < 0.5 ? 1 : Math.floor(Math.random() * 19) + 2;
      const difficulty = difficulties[Math.floor(level / 5)] || 'expert';
      
      const bot = {
        username: `${baseName}_${i}`,
        characterClass: characterClass,
        level: level,
        difficulty: difficulty,
        baseStats: {
          strength: 10 + Math.floor(Math.random() * 5),
          agility: 10 + Math.floor(Math.random() * 5),
          intuition: 10 + Math.floor(Math.random() * 5),
          endurance: 10 + Math.floor(Math.random() * 5)
        },
        personality: {
          aggressiveness: Math.random(),
          predictability: Math.random(),   
          // Fixed: Use values that meet schema requirements (min: 100 after you update the model)
          // Or use 500+ if you haven't updated the model yet
          reactionTime: 200 + Math.random() * 800 // 0.2-1 second (requires model update)
          // Alternative if model not updated: reactionTime: 500 + Math.random() * 500 // 0.5-1 second
        },
        wins: Math.floor(Math.random() * level * 10),
        losses: Math.floor(Math.random() * level * 5),
        avatar: `images/bot-avatars/bot-${characterClass}.png`,
        isActive: true
      };

      // Add some equipment for higher level bots
      if (level > 5) {
        bot.equipment = {
          weapon: { name: 'Bot Sword', damage: level * 2, type: 'weapon' }
        };
      }
      if (level > 10) {
        bot.equipment.armor = { name: 'Bot Armor', defense: level, type: 'armor' };
      }
      if (level > 15) {
        bot.equipment.shield = { name: 'Bot Shield', defense: Math.floor(level / 2), type: 'shield' };
      }

      bots.push(bot);
    }

    // Insert all bots
    await Bot.insertMany(bots);
    console.log(`Created ${count} bots successfully`);

    // List created bots with more details
    const createdBots = await Bot.find({}).select('username characterClass level difficulty personality.reactionTime');
    console.log('\nCreated bots:');
    createdBots.forEach(bot => {
      console.log(`- ${bot.username} (${bot.characterClass}, Level ${bot.level}, ${bot.difficulty}, ${bot.personality.reactionTime}ms reaction)`);
    });

    // Show summary statistics
    console.log('\n📊 Bot Creation Summary:');
    const totalBots = await Bot.countDocuments();
    console.log(`Total bots in database: ${totalBots}`);
    
    const level1Bots = await Bot.countDocuments({ level: 1 });
    console.log(`Level 1 bots: ${level1Bots}`);
    
    const botsByDifficulty = await Bot.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('Bots by difficulty:');
    botsByDifficulty.forEach(group => {
      console.log(`  ${group._id}: ${group.count} bots`);
    });

    mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    
  } catch (error) {
    console.error('Error seeding bots:', error);
    mongoose.connection.close();
  }
}

// Run with: node scripts/seedBots.js [count]
const count = parseInt(process.argv[2]) || 20;
seedBots(count);