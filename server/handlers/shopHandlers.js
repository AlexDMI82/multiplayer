// server/handlers/shopHandlers.js - Shop-related socket handlers

const { Inventory } = require('../../models');
const shopItems = require('../data/shopItems');

class ShopHandlers {
  constructor(io) {
    this.io = io;
  }

  // Get shop items
  async getShopItems(socket) {
    console.log('Sending shop items to', socket.user.username);
    socket.emit('shopItems', shopItems);
  }

  // Buy item
  async buyItem(socket, data) {
    try {
      const { itemId, itemType } = data;
      console.log(`${socket.user.username} attempting to buy ${itemId}`);
      
      // Find the item in shop
      let item = null;
      if (shopItems[itemType]) {
        item = shopItems[itemType].find(i => i.id === itemId);
      }
      
      if (!item) {
        socket.emit('purchaseFailed', { reason: 'Item not found' });
        return;
      }
      
      // Get player inventory
      const inventory = await Inventory.findOne({ userId: socket.user._id });
      if (!inventory) {
        socket.emit('purchaseFailed', { reason: 'Inventory not found' });
        return;
      }
      
      // Check if player has enough gold
      if (inventory.gold < item.price) {
        socket.emit('purchaseFailed', { reason: 'Insufficient gold' });
        return;
      }
      
      // Create item object for inventory
      const inventoryItem = {
        id: `${item.id}_${Date.now()}`, // Unique instance ID
        itemId: item.id,
        name: item.name,
        type: item.type,
        damage: item.damage || 0,
        defense: item.defense || 0,
        rarity: item.rarity,
        image: item.image,
        description: item.description
      };
      
      // Update inventory
      inventory.gold -= item.price;
      inventory.inventory.push(inventoryItem);
      await inventory.save();
      
      console.log(`${socket.user.username} purchased ${item.name} for ${item.price} gold`);
      
      // Send success response
      socket.emit('purchaseComplete', {
        item: item,
        newGold: inventory.gold
      });
      
      // Send updated inventory
      socket.emit('inventory', {
        gold: inventory.gold,
        equipped: inventory.equipped,
        inventory: inventory.inventory
      });
      
    } catch (error) {
      console.error('Error processing purchase:', error);
      socket.emit('purchaseFailed', { reason: 'Server error' });
    }
  }

  // Equip item
  async equipItem(socket, data) {
    try {
      const { itemId, itemType } = data;
      console.log(`${socket.user.username} attempting to equip ${itemId}`);
      
      // Get player inventory
      const inventory = await Inventory.findOne({ userId: socket.user._id });
      if (!inventory) {
        console.error('Inventory not found');
        return;
      }
      
      // Find item in inventory
      const itemIndex = inventory.inventory.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        console.error('Item not found in inventory');
        return;
      }
      
      const item = inventory.inventory[itemIndex];
      
      // If there's already an item equipped in this slot, move it back to inventory
      if (inventory.equipped[itemType]) {
        inventory.inventory.push(inventory.equipped[itemType]);
      }
      
      // Equip the new item
      inventory.equipped[itemType] = item;
      
      // Remove from inventory
      inventory.inventory.splice(itemIndex, 1);
      
      // Save changes
      await inventory.save();
      
      console.log(`${socket.user.username} equipped ${item.name}`);
      
      // Send updated equipment
      socket.emit('equipmentUpdated', {
        equipped: inventory.equipped,
        inventory: inventory.inventory
      });
      
    } catch (error) {
      console.error('Error equipping item:', error);
    }
  }

  // Register all shop-related socket events
  registerHandlers(socket) {
    socket.on('getShopItems', () => this.getShopItems(socket));
    socket.on('buyItem', (data) => this.buyItem(socket, data));
    socket.on('equipItem', (data) => this.equipItem(socket, data));
  }
}

module.exports = ShopHandlers;