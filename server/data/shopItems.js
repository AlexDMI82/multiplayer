// server/data/shopItems.js - Complete Shop items database (FIXED: Correct helmet paths, no leading slashes)

const shopItems = {
  weapons: [
    {
      id: 'sword_001',
      name: 'Dark Sword',
      type: 'weapon',
      price: 100,
      damage: 5,
      rarity: 'common',
      image: 'images/swords/DarkSword.jpg',
      description: 'A basic iron sword, reliable and sturdy.'
    },
    {
      id: 'sword_002',
      name: 'Flaming Sword',
      type: 'weapon',
      price: 500,
      damage: 12,
      rarity: 'rare',
      image: 'images/swords/FlamingSword.jpg',
      description: 'A sword imbued with the essence of fire, burns enemies on hit.'
    },
    {
      id: 'sword_003',
      name: 'Poison Sword',
      type: 'weapon',
      price: 800,
      damage: 15,
      rarity: 'epic',
      image: 'images/swords/PoisonSword.jpg',
      description: 'A venomous blade that poisons enemies with each strike.'
    },
    {
      id: 'sword_004',
      name: 'Soul Sword',
      type: 'weapon',
      price: 1200,
      damage: 18,
      rarity: 'epic',
      image: 'images/swords/SoulSword.jpg',
      description: 'Forged in darkness, this blade drains the life force of enemies.'
    },
    {
      id: 'sword_005',
      name: 'Spectral Sword',
      type: 'weapon',
      price: 1500,
      damage: 20,
      rarity: 'legendary',
      image: 'images/swords/SpectralSword.jpg',
      description: 'A ghostly blade that phases through armor.'
    },
    {
      id: 'sword_006',
      name: 'Vampire Sword',
      type: 'weapon',
      price: 2000,
      damage: 22,
      rarity: 'legendary',
      image: 'images/swords/VampireSword.jpg',
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
      image: 'images/armor/leather.png',
      description: 'Basic leather protection for adventurers.'
    },
    {
      id: 'armor_002',
      name: 'Iron Chestplate',
      type: 'armor',
      price: 400,
      defense: 10,
      rarity: 'uncommon',
      image: 'images/armor/iron.png',
      description: 'Solid iron protection for the torso.'
    },
    {
      id: 'armor_003',
      name: 'Steel Plate Armor',
      type: 'armor',
      price: 800,
      defense: 15,
      rarity: 'rare',
      image: 'images/armor/steel.png',
      description: 'Heavy steel armor providing excellent protection.'
    },
    {
      id: 'armor_004',
      name: 'Dragon Scale Armor',
      type: 'armor',
      price: 1500,
      defense: 20,
      rarity: 'legendary',
      image: 'images/armor/dragon.png',
      description: 'Legendary armor crafted from ancient dragon scales.'
    }
  ],
  shields: [
    {
      id: 'shield_001',
      name: 'Dark Shield',
      type: 'shield',
      price: 100,
      defense: 3,
      rarity: 'common',
      image: 'images/shields/darkShield.jpg',
      description: 'A basic dark shield providing minimal protection.'
    },
    {
      id: 'shield_002',
      name: 'Flame Shield',
      type: 'shield',
      price: 300,
      defense: 7,
      rarity: 'uncommon',
      image: 'images/shields/flameShield.jpg',
      description: 'A shield imbued with fire magic, burns attackers on contact.'
    },
    {
      id: 'shield_003',
      name: 'Long Shield',
      type: 'shield',
      price: 600,
      defense: 12,
      rarity: 'rare',
      image: 'images/shields/longShield.jpg',
      description: 'An elongated shield providing excellent coverage and protection.'
    },
    {
      id: 'shield_004',
      name: 'Poison Shield',
      type: 'shield',
      price: 800,
      defense: 15,
      rarity: 'epic',
      image: 'images/shields/poisonShield.jpg',
      description: 'A toxic shield that poisons enemies who strike it.'
    },
    {
      id: 'shield_005',
      name: 'Spectral Shield',
      type: 'shield',
      price: 1200,
      defense: 18,
      rarity: 'legendary',
      image: 'images/shields/spectralShield.jpg',
      description: 'A ghostly shield that can phase through certain attacks.'
    },
    {
      id: 'shield_006',
      name: 'Undead Shield',
      type: 'shield',
      price: 1500,
      defense: 20,
      rarity: 'legendary',
      image: 'images/shields/undeadShield.jpg',
      description: 'A cursed shield crafted from undead essence, radiates dark energy.'
    }
  ],
  // FIXED: All helmets now use correct "helmets" folder path (plural) with no leading slashes
  helmets: [
    {
      id: 'helmet_001',
      name: 'Dark Helm',
      type: 'helmet',
      price: 100,
      defense: 2,
      rarity: 'common',
      image: 'images/helmets/darHelm.jpg',
      description: 'A basic dark helmet providing minimal head protection.'
    },
    {
      id: 'helmet_002',
      name: 'Fire Helm',
      type: 'helmet',
      price: 300,
      defense: 5,
      rarity: 'uncommon',
      image: 'images/helmets/fireHelm.jpg',
      description: 'A helmet forged with fire magic, radiates warmth and protection.'
    },
    {
      id: 'helmet_003',
      name: 'Poison Helm',
      type: 'helmet',
      price: 600,
      defense: 8,
      rarity: 'rare',
      image: 'images/helmets/poisonHelm.jpg',
      description: 'A toxic helmet that creates a poisonous aura around the wearer.'
    },
    {
      id: 'helmet_004',
      name: 'Soul Helm',
      type: 'helmet',
      price: 900,
      defense: 12,
      rarity: 'epic',
      image: 'images/helmets/soulsHelm.jpg',
      description: 'A cursed helmet that channels the power of trapped souls.'
    },
    {
      id: 'helmet_005',
      name: 'Spectral Helm',
      type: 'helmet',
      price: 1200,
      defense: 15,
      rarity: 'legendary',
      image: 'images/helmets/spectralHelm.jpg',
      description: 'A ghostly helmet that provides ethereal protection and enhanced vision.'
    },
    {
      id: 'helmet_006',
      name: 'Vampire Helm',
      type: 'helmet',
      price: 1500,
      defense: 18,
      rarity: 'legendary',
      image: 'images/helmets/vampireHelm.jpg',
      description: 'A vampiric helmet that drains enemy life force and transfers it to the wearer.'
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
      image: 'images/accessories/boots.png',
      description: 'Comfortable leather boots for long journeys.'
    },
    {
      id: 'boots_002',
      name: 'Steel Boots',
      type: 'boots',
      price: 200,
      defense: 3,
      rarity: 'uncommon',
      image: 'images/accessories/steel_boots.png',
      description: 'Heavy steel boots with reinforced toes.'
    },
    {
      id: 'gloves_001',
      name: 'Leather Gloves',
      type: 'gloves',
      price: 60,
      defense: 1,
      rarity: 'common',
      image: 'images/accessories/gloves.png',
      description: 'Basic leather gloves for protection.'
    },
    {
      id: 'gloves_002',
      name: 'Steel Gauntlets',
      type: 'gloves',
      price: 180,
      defense: 3,
      rarity: 'uncommon',
      image: 'images/accessories/gauntlets.png',
      description: 'Reinforced steel gauntlets for protection.'
    },
    {
      id: 'amulet_001',
      name: 'Health Amulet',
      type: 'amulet',
      price: 300,
      defense: 0,
      rarity: 'rare',
      image: 'images/accessories/amulet.png',
      description: 'Mystical amulet that boosts vitality. Increases maximum health by 25 points.'
    },
    {
      id: 'amulet_002',
      name: 'Power Amulet',
      type: 'amulet',
      price: 350,
      defense: 0,
      rarity: 'rare',
      image: 'images/accessories/power_amulet.png',
      description: 'Magical amulet that enhances strength. Increases damage by 5 points.'
    },
    {
      id: 'ring_001',
      name: 'Power Ring',
      type: 'ring',
      price: 250,
      defense: 0,
      rarity: 'rare',
      image: 'images/accessories/ring.png',
      description: 'Ring imbued with magical power. Increases critical hit chance by 5%.'
    },
    {
      id: 'ring_002',
      name: 'Defense Ring',
      type: 'ring',
      price: 220,
      defense: 2,
      rarity: 'uncommon',
      image: 'images/accessories/defense_ring.png',
      description: 'A sturdy ring that provides additional protection.'
    }
  ]
};

module.exports = shopItems;