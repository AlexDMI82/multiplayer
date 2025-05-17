
class CombatSystem {
    constructor() {
        this.baseAttackDamage = {
            'head': 25,
            'body': 15,
            'legs': 10
        };
    }
    
    // Calculate total damage for an attack
    calculateDamage(attacker, defender, attackArea, isBlocked) {
        // If attack was blocked, check for ignore block ability (Ironbound)
        if (isBlocked) {
            // Check if attacker has ignore block ability (Ironbound)
            const ignoreBlockChance = this.hasSpecialAbility(attacker, 'ignoreBlock') ? 0.05 : 0;
            const ignoreBlockRoll = Math.random();
            
            if (ignoreBlockRoll <= ignoreBlockChance) {
                console.log('Ignore block ability activated!');
                // Continue with damage calculation as if not blocked
            } else {
                // Attack was blocked and ability didn't activate
                return 0;
            }
        }
        
        // Get base damage for the attack area
        let damage = this.baseAttackDamage[attackArea] || 0;
        
        // Add weapon damage if equipped
        if (attacker.equipment && attacker.equipment.weapon) {
            damage += attacker.equipment.weapon.damage || 0;
        }
        
        // Add strength bonus (2 damage per strength point)
        if (attacker.damageBonus) {
            damage += attacker.damageBonus;
        }
        
        // Calculate if this is a critical hit
        const isCritical = this.rollForCritical(attacker);
        if (isCritical) {
            damage *= 2;
            console.log('Critical hit! Damage doubled to:', damage);
        }
        
        // If attack wasn't blocked, check if it was evaded
        const wasEvaded = this.checkEvasion(attacker, defender);
        if (wasEvaded) {
            console.log('Attack evaded!');
            return 0;
        }
        
        // Apply armor and shield defense if not evaded
        let totalDefense = 0;
        
        // Apply armor defense if equipped
        if (defender.equipment && defender.equipment.armor) {
            totalDefense += defender.equipment.armor.defense || 0;
        }
        
        // Apply shield defense if equipped
        if (defender.equipment && defender.equipment.shield) {
            totalDefense += defender.equipment.shield.defense || 0;
        }
        
        // Apply helmet defense if equipped
        if (defender.equipment && defender.equipment.helmet) {
            totalDefense += defender.equipment.helmet.defense || 0;
        }
        
        // Reduce damage by total defense, but not below 1
        damage = Math.max(1, damage - totalDefense);
        
        // Apply poison effect (Venomfang)
        if (this.hasSpecialAbility(attacker, 'poison')) {
            const poisonChance = 0.05; // 5%
            const poisonRoll = Math.random();
            
            if (poisonRoll <= poisonChance) {
                const poisonDamage = Math.floor(damage * 0.5); // 50% extra damage
                damage += poisonDamage;
                console.log('Poison ability activated! Added damage:', poisonDamage);
            }
        }
        
        return damage;
    }
    
    // Check if the attack was evaded
    checkEvasion(attacker, defender) {
        // Base evasion chance from agility (1% per point)
        let evasionChance = defender.evasionChance || 0;
        
        // Bonus evasion for Shadowsteel
        if (this.hasSpecialAbility(defender, 'evade')) {
            evasionChance += 5; // Additional 5% chance to evade
        }
        
        // Reduce evasion chance based on attacker's intuition
        const evasionReduction = attacker.enemyEvasionReduction || 0;
        evasionChance = Math.max(0, evasionChance - evasionReduction);
        
        // Roll for evasion (random number from 1-100)
        const roll = Math.floor(Math.random() * 100) + 1;
        
        // If roll is less than or equal to evasion chance, attack is evaded
        return roll <= evasionChance;
    }
    
    // Roll for critical hit
    rollForCritical(attacker) {
        // Critical hit chance from intuition (1% per point)
        let criticalChance = attacker.criticalChance || 0;
        
        // Bonus critical chance for Flameheart
        if (this.hasSpecialAbility(attacker, 'criticalHit')) {
            criticalChance += 5; // Additional 5% chance to crit
        }
        
        // Roll for critical hit (random number from 1-100)
        const roll = Math.floor(Math.random() * 100) + 1;
        
        // If roll is less than or equal to critical chance, it's a critical hit
        return roll <= criticalChance;
    }
    
    // Helper to check if a player has a specific special ability
    hasSpecialAbility(player, abilityName) {
        return player.specialAbility === abilityName;
    }
    
    // Process a full round of combat
    processRound(players, moves) {
        const playerIds = Object.keys(players);
        const damageDealt = {};
        const combatLog = [];
        
        // Process each player's move against the other
        playerIds.forEach(attackerId => {
            const defenderId = playerIds.find(id => id !== attackerId);
            const attacker = players[attackerId];
            const defender = players[defenderId];
            const attackerMove = moves[attackerId];
            const defenderMove = moves[defenderId];
            
            // Initialize damage for this player
            damageDealt[attackerId] = 0;
            
            // Skip if attacker didn't make a move or chose no attack area
            if (!attackerMove || !attackerMove.attackArea || attackerMove.auto) {
                combatLog.push({
                    type: 'skip',
                    player: attackerId,
                    message: `${attacker.username} did not attack.`
                });
                return;
            }
            
            // Check if defender successfully blocked
            const successfulBlock = defenderMove && 
                                   defenderMove.blockArea === attackerMove.attackArea;
            
            // Calculate damage
            const damage = this.calculateDamage(
                attacker, 
                defender, 
                attackerMove.attackArea, 
                successfulBlock
            );
            
            // Record the damage dealt
            damageDealt[attackerId] = damage;
            
            // Apply the damage to defender
            defender.health = Math.max(0, defender.health - damage);
            
            // Add to combat log
            if (successfulBlock && damage === 0) {
                // Blocked successfully
                combatLog.push({
                    type: 'block',
                    player: defenderId,
                    message: `${defender.username} blocked ${attacker.username}'s attack to the ${attackerMove.attackArea}!`
                });
            } else if (successfulBlock && damage > 0) {
                // Block ignored (Ironbound ability)
                combatLog.push({
                    type: 'hit',
                    player: attackerId,
                    targetArea: attackerMove.attackArea,
                    damage: damage,
                    critical: false,
                    ignoreBlock: true,
                    message: `${attacker.username} broke through ${defender.username}'s block with overwhelming force, dealing ${damage} damage!`
                });
            } else if (damage === 0) {
                // Evaded
                combatLog.push({
                    type: 'evade',
                    player: defenderId,
                    message: `${defender.username} evaded ${attacker.username}'s attack to the ${attackerMove.attackArea}!`
                });
            } else {
                // Normal hit or critical hit
                const isCritical = damage > this.baseAttackDamage[attackerMove.attackArea] * 1.5;
                
                if (isCritical) {
                    combatLog.push({
                        type: 'hit',
                        player: attackerId,
                        targetArea: attackerMove.attackArea,
                        damage: damage,
                        critical: true,
                        message: `${attacker.username} landed a CRITICAL HIT on ${defender.username}'s ${attackerMove.attackArea} for ${damage} damage!`
                    });
                } else if (damage > this.baseAttackDamage[attackerMove.attackArea] && this.hasSpecialAbility(attacker, 'poison')) {
                    // Poison hit
                    combatLog.push({
                        type: 'hit',
                        player: attackerId,
                        targetArea: attackerMove.attackArea,
                        damage: damage,
                        poison: true,
                        message: `${attacker.username}'s poisoned blade struck ${defender.username}'s ${attackerMove.attackArea}, dealing ${damage} damage!`
                    });
                } else {
                    // Regular hit
                    combatLog.push({
                        type: 'hit',
                        player: attackerId,
                        targetArea: attackerMove.attackArea,
                        damage: damage,
                        critical: false,
                        message: `${attacker.username} hit ${defender.username}'s ${attackerMove.attackArea} for ${damage} damage!`
                    });
                }
            }
        });
        
        // Check if any player is defeated (health <= 0)
        let gameOver = false;
        let winner = null;
        
        playerIds.forEach(playerId => {
            if (players[playerId].health <= 0) {
                gameOver = true;
                winner = playerIds.find(id => id !== playerId);
                
                combatLog.push({
                    type: 'defeat',
                    player: playerId,
                    message: `${players[playerId].username} has been defeated!`
                });
                
                combatLog.push({
                    type: 'victory',
                    player: winner,
                    message: `${players[winner].username} is victorious!`
                });
            }
        });
        
        return {
            damageDealt,
            combatLog,
            gameOver,
            winner
        };
    }
}

// Export the combat system
window.combatSystem = new CombatSystem();