// DEBUG VERSION - Add extensive logging to find where extra damage comes from

class CombatSystem {
    constructor() {
        this.baseAttackDamage = {
            'head': 10,
            'body': 10,
            'legs': 10
        };
    }
    
    calculateDamage(attacker, defender, attackArea, isBlocked) {
        console.log(`\n=== DAMAGE CALCULATION START ===`);
        console.log(`Attacker: ${attacker.username}, Defender: ${defender.username}`);
        console.log(`Attack Area: ${attackArea}, Is Blocked: ${isBlocked}`);
        
        // If attack was blocked, check for ignore block ability (Ironbound)
        if (isBlocked) {
            const ignoreBlockChance = this.hasSpecialAbility(attacker, 'ignoreBlock') ? 0.05 : 0;
            const ignoreBlockRoll = Math.random();
            
            if (ignoreBlockRoll <= ignoreBlockChance) {
                console.log('Ignore block ability activated!');
            } else {
                console.log('Attack blocked, returning 0 damage');
                return { 
                    damage: 0, 
                    isCritical: false, 
                    wasEvaded: false, 
                    ignoreBlock: false, 
                    poisonActivated: false 
                };
            }
        }
        
        // Get base damage for the attack area
        let damage = this.baseAttackDamage[attackArea] || 0;
        console.log(`1. Base damage: ${damage}`);
        
        // Add weapon damage if equipped
        if (attacker.equipment && attacker.equipment.weapon) {
            const weaponDamage = attacker.equipment.weapon.damage || 0;
            damage += weaponDamage;
            console.log(`2. After weapon (+${weaponDamage}): ${damage}`);
        }
        
        // Add strength bonus (2 damage per strength point)
        if (attacker.damageBonus) {
            damage += attacker.damageBonus;
            console.log(`3. After strength bonus (+${attacker.damageBonus}): ${damage}`);
        }
        
        // Calculate if this is a critical hit
        const isCritical = this.rollForCritical(attacker);
        console.log(`4. Is Critical Hit: ${isCritical}`);
        
        if (isCritical) {
            const preCritDamage = damage;
            damage *= 2;
            console.log(`5. Critical damage: ${preCritDamage} × 2 = ${damage}`);
        }
        
        // If attack wasn't blocked, check if it was evaded
        const wasEvaded = this.checkEvasion(attacker, defender);
        if (wasEvaded) {
            console.log('Attack evaded!');
            return { 
                damage: 0, 
                isCritical: false, 
                wasEvaded: true, 
                ignoreBlock: false, 
                poisonActivated: false 
            };
        }
        
        // Apply armor and shield defense if not evaded
        let totalDefense = 0;
        
        if (defender.equipment && defender.equipment.armor) {
            totalDefense += defender.equipment.armor.defense || 0;
        }
        
        if (defender.equipment && defender.equipment.shield) {
            totalDefense += defender.equipment.shield.defense || 0;
        }
        
        if (defender.equipment && defender.equipment.helmet) {
            totalDefense += defender.equipment.helmet.defense || 0;
        }
        
        console.log(`6. Total defense: ${totalDefense}`);
        
        // Reduce damage by total defense, but not below 1
        const preDefenseDamage = damage;
        damage = Math.max(1, damage - totalDefense);
        console.log(`7. After defense: ${preDefenseDamage} - ${totalDefense} = ${damage}`);
        
        // Apply poison effect (Venomfang)
        let poisonActivated = false;
        if (this.hasSpecialAbility(attacker, 'poison')) {
            const poisonChance = 0.05; // 5%
            const poisonRoll = Math.random();
            
            if (poisonRoll <= poisonChance) {
                const poisonDamage = Math.floor(damage * 0.5); // 50% extra damage
                damage += poisonDamage;
                poisonActivated = true;
                console.log(`8. Poison activated: +${poisonDamage} = ${damage}`);
            }
        }
        
        console.log(`=== FINAL DAMAGE: ${damage} ===\n`);
        
        return { 
            damage: damage, 
            isCritical: isCritical, 
            wasEvaded: false, 
            ignoreBlock: isBlocked && damage > 0,
            poisonActivated: poisonActivated 
        };
    }
    
    // Check if the attack was evaded
    checkEvasion(attacker, defender) {
        // Base evasion chance from agility (0.5% per point instead of 1%)
        let evasionChance = (defender.evasionChance || 0) * 0.5;
        
        // Bonus evasion for Shadowsteel
        if (this.hasSpecialAbility(defender, 'evade')) {
            evasionChance += 2.5; // Reduced from 5
        }
        
        // Reduce evasion chance based on attacker's intuition
        const evasionReduction = (attacker.enemyEvasionReduction || 0) * 0.5;
        evasionChance = Math.max(0, evasionChance - evasionReduction);
        
        // Roll for evasion (random number from 1-100)
        const roll = Math.floor(Math.random() * 100) + 1;
        
        console.log(`Evasion check: ${roll} vs ${evasionChance}%`);
        
        // If roll is less than or equal to evasion chance, attack is evaded
        return roll <= evasionChance;
    }
    
    // Roll for critical hit
    rollForCritical(attacker) {
        // Critical hit chance from intuition (0.5% per point instead of 1%)
        let criticalChance = (attacker.criticalChance || 0) * 0.5;
        
        // Bonus critical chance for Flameheart
        if (this.hasSpecialAbility(attacker, 'criticalHit')) {
            criticalChance += 2.5; // Reduced from 5
        }
        
        // Roll for critical hit (random number from 1-100)
        const roll = Math.floor(Math.random() * 100) + 1;
        
        console.log(`Critical check: ${roll} vs ${criticalChance}%`);
        
        // If roll is less than or equal to critical chance, it's a critical hit
        return roll <= criticalChance;
    }
    
    // Helper to check if a player has a specific special ability
    hasSpecialAbility(player, abilityName) {
        return player.specialAbility === abilityName;
    }
    
    // Process a full round of combat
    processRound(players, moves) {
        console.log(`\n🎯 PROCESSING COMBAT ROUND`);
        console.log(`Players:`, Object.keys(players));
        
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
            
            console.log(`\n👤 ${attacker.username} vs ${defender.username}`);
            console.log(`Attacker health before: ${attacker.health}`);
            console.log(`Defender health before: ${defender.health}`);
            
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
            const damageResult = this.calculateDamage(
                attacker, 
                defender, 
                attackerMove.attackArea, 
                successfulBlock
            );

            const damage = damageResult.damage;
            const isCritical = damageResult.isCritical;
            const wasEvaded = damageResult.wasEvaded;
            const ignoreBlock = damageResult.ignoreBlock;
            const poisonActivated = damageResult.poisonActivated;
            
            console.log(`💥 Calculated damage: ${damage}`);
            
            // Record the damage dealt
            damageDealt[attackerId] = damage;
            
            // Apply the damage to defender
            const oldHealth = defender.health;
            defender.health = Math.max(0, defender.health - damage);
            const actualDamageApplied = oldHealth - defender.health;
            
            console.log(`🩸 Health change: ${oldHealth} → ${defender.health} (${actualDamageApplied} damage applied)`);
            
            // ⚠️ CHECK FOR DISCREPANCY
            if (damage !== actualDamageApplied) {
                console.error(`🚨 DAMAGE MISMATCH!`);
                console.error(`   Calculated: ${damage}`);
                console.error(`   Actually applied: ${actualDamageApplied}`);
                console.error(`   Difference: ${actualDamageApplied - damage}`);
            }
            
            // Add to combat log (rest of the function stays the same)
            if (successfulBlock && damage === 0) {
                combatLog.push({
                    type: 'block',
                    player: defenderId,
                    message: `${defender.username} blocked ${attacker.username}'s attack to the ${attackerMove.attackArea}!`
                });
            } else if (ignoreBlock) {
                combatLog.push({
                    type: 'hit',
                    player: attackerId,
                    targetArea: attackerMove.attackArea,
                    damage: damage,
                    critical: isCritical,
                    ignoreBlock: true,
                    message: `${attacker.username} broke through ${defender.username}'s block with overwhelming force, dealing ${damage} damage!`
                });
            } else if (wasEvaded) {
                combatLog.push({
                    type: 'evade',
                    player: defenderId,
                    message: `${defender.username} evaded ${attacker.username}'s attack to the ${attackerMove.attackArea}!`
                });
            } else if (damage > 0) {
                if (isCritical) {
                    combatLog.push({
                        type: 'hit',
                        player: attackerId,
                        targetArea: attackerMove.attackArea,
                        damage: damage,
                        critical: true,
                        message: `${attacker.username} landed a CRITICAL HIT on ${defender.username}'s ${attackerMove.attackArea} for ${damage} damage!`
                    });
                } else if (poisonActivated) {
                    combatLog.push({
                        type: 'hit',
                        player: attackerId,
                        targetArea: attackerMove.attackArea,
                        damage: damage,
                        poison: true,
                        message: `${attacker.username}'s poisoned blade struck ${defender.username}'s ${attackerMove.attackArea}, dealing ${damage} damage!`
                    });
                } else {
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
        
        console.log(`\n🏁 ROUND COMPLETE`);
        console.log(`Damage dealt:`, damageDealt);
        console.log(`Final health:`, Object.fromEntries(playerIds.map(id => [id, players[id].health])));
        
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