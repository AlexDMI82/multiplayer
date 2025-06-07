// fix-user-gold.js - Run this script to fix existing user's gold amount

const mongoose = require('mongoose');
const { User, Inventory } = require('./models');

async function fixUserGold() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb+srv://braucamkopa:Y1ytE02fH8ErX3qi@cluster0.eedzhyr.mongodb.net/multiplayer-game?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB');
        
        // Find all users and their inventories
        const users = await User.find({});
        console.log(`Found ${users.length} users`);
        
        for (const user of users) {
            console.log(`\n👤 Processing user: ${user.username}`);
            
            // Find or create inventory for this user
            let inventory = await Inventory.findOne({ userId: user._id });
            
            if (!inventory) {
                console.log('  📦 Creating new inventory with 1000 gold');
                inventory = await Inventory.create({
                    userId: user._id,
                    gold: 1000,
                    equipped: {},
                    inventory: []
                });
                console.log('  ✅ New inventory created');
            } else {
                console.log(`  💰 Current gold: ${inventory.gold}`);
                
                // Update gold to 1000 if it's less than 1000
                if (inventory.gold < 1000) {
                    console.log(`  🔧 Updating gold from ${inventory.gold} to 1000`);
                    inventory.gold = 1000;
                    await inventory.save();
                    console.log('  ✅ Gold updated to 1000');
                } else {
                    console.log('  ✅ Gold amount is already sufficient');
                }
            }
            
            // Ensure equipped object exists
            if (!inventory.equipped) {
                inventory.equipped = {};
                await inventory.save();
                console.log('  🛡️ Added equipped object');
            }
            
            // Ensure inventory array exists
            if (!inventory.inventory) {
                inventory.inventory = [];
                await inventory.save();
                console.log('  📦 Added inventory array');
            }
        }
        
        console.log('\n🎉 All users processed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error fixing user gold:', error);
        process.exit(1);
    }
}

// Run the fix
fixUserGold();