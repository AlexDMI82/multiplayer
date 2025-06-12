// handlers/profileHandlers.js
const { Stats, Inventory, PlayerLevel } = require('../models');
const jwt = require('jsonwebtoken');

class ProfileHandlers {
  constructor(io, jwtSecret) {
    this.io = io;
    this.jwtSecret = jwtSecret;
  }

  async ensureInventoryExists(userId) {
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

  registerHandlers(socket) {
    console.log(`👤 Registering profile handlers for ${socket.user.username}`);

    socket.on('getProfile', async () => {
      try {
        const stats = await Stats.findOne({ userId: socket.user._id });
        const inventory = await this.ensureInventoryExists(socket.user._id);
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
        socket.emit('profileError', { message: 'Failed to fetch profile' });
      }
    });

    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, this.jwtSecret);
        if (decoded.id === socket.user._id.toString()) {
          socket.emit('authenticated', { success: true });
        } else {
          socket.emit('authError', { message: 'Invalid token' });
        }
      } catch (error) {
        socket.emit('authError', { message: 'Authentication failed' });
      }
    });
  }
}

module.exports = ProfileHandlers;