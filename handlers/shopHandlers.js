// handlers/shopHandlers.js
const { Inventory } = require('../models');
// --- FIXED: Import the complete shop data ---
const shopItems = require('../server/data/shopItems');

class ShopHandlers {
  constructor(io) {
    this.io = io;
    // --- FIXED: Use the imported shop data instead of a hardcoded list ---
    this.SHOP_DATA = shopItems;
  }

  findItemById(itemId) {
    // This logic can be simplified now
    for (const category of Object.values(this.SHOP_DATA)) {
      const item = category.find(item => item.id === itemId);
      if (item) return item;
    }
    return null;
  }

  registerHandlers(socket) {
    console.log(`🏪 Registering shop handlers for ${socket.user.username}`);

    socket.on('getShopItems', () => {
      console.log(`📦 Sending complete shop items to ${socket.user.username}`);
      // This will now send the full, correct list from the imported file.
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

    socket.on('getInventory', async () => {
      try {
        const inventory = await Inventory.findOne({ userId: socket.user._id });
        if (inventory) {
          socket.emit('inventory', inventory);
        }
      } catch (error) {
        console.error('Error getting inventory:', error);
        socket.emit('inventoryError', { message: 'Failed to get inventory' });
      }
    });
  }
}

module.exports = ShopHandlers;