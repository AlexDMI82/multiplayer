// server/data/shopItems.js - Complete Shop items database

const shopItems = {
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
    {
      id: 'sword_003',
      name: 'Poison Sword',
      type: 'weapon',
      price: 800,
      damage: 15,
      rarity: 'epic',
      image: '/images/swords/PoisonSword.jpg',
      description: 'A venomous blade that poisons enemies with each strike.'
    },
    {
      id: 'sword_004',
      name: 'Soul Sword',
      type: 'weapon',
      price: 1200,
      damage: 18,
      rarity: 'epic',
      image: '/images/swords/SoulSword.jpg',
      description: 'Forged in darkness, this blade drains the life force of enemies.'
    },
    {
      id: 'sword_005',
      name: 'Spectral Sword',
      type: 'weapon',
      price: 1500,
      damage: 20,
      rarity: 'legendary',
      image: '/images/swords/SpectralSword.jpg',
      description: 'A ghostly blade that phases through armor.'
    },
    {
      id: 'sword_006',
      name: 'Vampire Sword',
      type: 'weapon',
      price: 2000,
      damage: 22,
      rarity: 'legendary',
      image: '/images/swords/VampireSword.jpg',
      description: 'This cursed blade heals the wielder with each successful hit.'
    }
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
    {
      id: 'armor_003',
      name: 'Steel Plate Armor',
      type: 'armor',
      price: 800,
      defense: 15,
      rarity: 'rare',
      image: '/images/armor/steel.png',
      description: 'Heavy steel armor providing excellent protection.'
    },
    {
      id: 'armor_004',
      name: 'Dragon Scale Armor',
      type: 'armor',
      price: 1500,
      defense: 20,
      rarity: 'legendary',
      image: '/images/armor/dragon.png',
      description: 'Legendary armor crafted from ancient dragon scales.'
    }
  ],
  shields: [
    {
      id: 'shield_001',
      name: 'Wooden Shield',
      type: 'shield',
      price: 100,
      defense: 3,
      rarity: 'common',
      image: '/images/shields/wooden.png',
      description: 'A simple wooden shield.'
    },
    {
      id: 'shield_002',
      name: 'Iron Shield',
      type: 'shield',
      price: 300,
      defense: 7,
      rarity: 'uncommon',
      image: '/images/shields/iron.png',
      description: 'A sturdy iron shield.'
    },
    {
      id: 'shield_003',
      name: 'Steel Shield',
      type: 'shield',
      price: 600,
      defense: 12,
      rarity: 'rare',
      image: '/images/shields/steel.png',
      description: 'A reinforced steel shield with excellent protection.'
    }
  ],
  helmets: [
    {
      id: 'helmet_001',
      name: 'Leather Cap',
      type: 'helmet',
      price: 100,
      defense: 2,
      rarity: 'common',
      image: '/images/helmets/leather.png',
      description: 'Basic leather head protection.'
    },
    {
      id: 'helmet_002',
      name: 'Iron Helm',
      type: 'helmet',
      price: 250,
      defense: 5,
      rarity: 'uncommon',
      image: '/images/helmets/iron.png',
      description: 'Solid iron helmet.'
    },
    {
      id: 'helmet_003',
      name: 'Knight\'s Helmet',
      type: 'helmet',
      price: 500,
      defense: 8,
      rarity: 'rare',
      image: '/images/helmets/knight.png',
      description: 'A noble knight\'s ceremonial helmet.'
    }
  ],
  accessories: [
    {
      id: 'boots_001',
      name: 'Leather Boots',
      type: 'boots',
      price: 80,
      defense: 1,
      rarity: 'common',
      image: '/images/accessories/boots.png',
      description: 'Comfortable leather boots for long journeys.'
    },
    {
      id: 'boots_002',
      name: 'Steel Boots',
      type: 'boots',
      price: 200,
      defense: 3,
      rarity: 'uncommon',
      image: '/images/accessories/steel_boots.png',
      description: 'Heavy steel boots with reinforced toes.'
    },
    {
      id: 'gloves_001',
      name: 'Leather Gloves',
      type: 'gloves',
      price: 60,
      defense: 1,
      rarity: 'common',
      image: '/images/accessories/gloves.png',
      description: 'Basic leather gloves for protection.'
    },
    {
      id: 'gloves_002',
      name: 'Steel Gauntlets',
      type: 'gloves',
      price: 180,
      defense: 3,
      rarity: 'uncommon',
      image: '/images/accessories/gauntlets.png',
      description: 'Reinforced steel gauntlets for protection.'
    },
    {
      id: 'amulet_001',
      name: 'Health Amulet',
      type: 'amulet',
      price: 300,
      defense: 0,
      rarity: 'rare',
      image: '/images/accessories/amulet.png',
      description: 'Mystical amulet that boosts vitality. Increases maximum health by 25 points.'
    },
    {
      id: 'amulet_002',
      name: 'Power Amulet',
      type: 'amulet',
      price: 350,
      defense: 0,
      rarity: 'rare',
      image: '/images/accessories/power_amulet.png',
      description: 'Magical amulet that enhances strength. Increases damage by 5 points.'
    },
    {
      id: 'ring_001',
      name: 'Power Ring',
      type: 'ring',
      price: 250,
      defense: 0,
      rarity: 'rare',
      image: '/images/accessories/ring.png',
      description: 'Ring imbued with magical power. Increases critical hit chance by 5%.'
    },
    {
      id: 'ring_002',
      name: 'Defense Ring',
      type: 'ring',
      price: 220,
      defense: 2,
      rarity: 'uncommon',
      image: '/images/accessories/defense_ring.png',
      description: 'A sturdy ring that provides additional protection.'
    }
  ]
};

module.exports = shopItems;