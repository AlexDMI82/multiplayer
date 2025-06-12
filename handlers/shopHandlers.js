// handlers/shopHandlers.js
const { Inventory } = require('../models');

class ShopHandlers {
  constructor(io) {
    this.io = io;
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
      ],
    };
  }

  findItemById(itemId) {
    for (const category of Object.values(this.SHOP_DATA)) {
      const item = category.find(item => item.id === itemId);
      if (item) return item;
    }
    return null;
  }

  registerHandlers(socket) {
    console.log(`🏪 Registering shop handlers for ${socket.user.username}`);

    socket.on('getShopItems', () => {
      console.log(`📦 Sending shop items to ${socket.user.username}`);
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