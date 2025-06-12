// handlers/challengeHandlers.js
const { Stats, PlayerLevel } = require('../models');

class ChallengeHandlers {
  constructor(io, activeChallenges, connectedPlayers, activeGames) {
    this.io = io;
    this.activeChallenges = activeChallenges;
    this.connectedPlayers = connectedPlayers;
    this.activeGames = activeGames;
  }

  registerHandlers(socket) {
    console.log(`🎯 Registering challenge handlers for ${socket.user.username}`);

    socket.on('challengePlayer', async (opponentId) => {
      try {
        console.log(`🎯 Challenge request: ${socket.user.username} challenging ${opponentId}`);
        
        const opponent = this.connectedPlayers.get(opponentId);
        if (!opponent) {
          socket.emit('challengeFailed', { message: 'Player not found or offline' });
          return;
        }
        
        // Check if either player is already in a game
        if (this.activeGames.has(socket.id) || this.activeGames.has(opponentId)) {
          socket.emit('challengeFailed', { message: 'One of the players is already in a game' });
          return;
        }
        
        const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const challengeData = {
          id: challengeId,
          challengerId: socket.id,
          challengerUserId: socket.user._id.toString(),
          opponentId: opponentId,
          timestamp: Date.now(),
          challenger: {
            socketId: socket.id,
            userId: socket.user._id.toString(),
            username: socket.user.username,
            avatar: socket.user.avatar,
            characterClass: socket.user.characterClass || 'unselected'
          }
        };
        
        this.activeChallenges.set(challengeId, challengeData);
        
        this.io.to(opponentId).emit('challengeReceived', challengeData);
        
        socket.emit('challengeSent', {
          id: challengeId,
          opponentName: opponent.username,
          timestamp: Date.now()
        });
        
        console.log(`✅ Challenge sent: ${challengeId}`);
        
        // Auto-expire challenge after 60 seconds
        setTimeout(() => {
          if (this.activeChallenges.has(challengeId)) {
            this.activeChallenges.delete(challengeId);
            this.io.to(socket.id).emit('challengeExpired', { challengeId });
            this.io.to(opponentId).emit('challengeExpired', { challengeId });
          }
        }, 60000);
        
      } catch (error) {
        console.error('Error processing challenge:', error);
        socket.emit('challengeFailed', { message: 'Failed to send challenge' });
      }
    });

    socket.on('respondToChallenge', async (data) => {
      try {
        const { challengeId, accepted, challengerId } = data;
        console.log(`🎯 Challenge response: ${challengeId}, accepted: ${accepted}`);
        
        const challenge = this.activeChallenges.get(challengeId);
        if (!challenge) {
          socket.emit('challengeError', { message: 'Challenge not found or expired' });
          return;
        }
        
        this.activeChallenges.delete(challengeId);
        
        if (accepted) {
          const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const challenger = this.connectedPlayers.get(challengerId);
          if (!challenger) {
            socket.emit('challengeError', { message: 'Challenger no longer available' });
            return;
          }
          
          const gameData = {
            gameId: gameId,
            opponent: {
              id: challengerId,
              userId: challenger.userId,
              username: challenger.username,
              avatar: challenger.avatar,
              characterClass: challenger.characterClass || 'unselected'
            }
          };
          
          const challengerGameData = {
            gameId: gameId,
            opponent: {
              id: socket.id,
              userId: socket.user._id.toString(),
              username: socket.user.username,
              avatar: socket.user.avatar,
              characterClass: socket.user.characterClass || 'unselected'
            }
          };
          
          socket.emit('challengeAccepted', gameData);
          this.io.to(challengerId).emit('challengeAccepted', challengerGameData);
          
          console.log(`✅ Game starting: ${gameId}`);
          
        } else {
          this.io.to(challengerId).emit('challengeRejected', {
            challengeId: challengeId,
            message: `${socket.user.username} declined your challenge`
          });
          
          console.log(`❌ Challenge declined: ${challengeId}`);
        }
        
      } catch (error) {
        console.error('Error responding to challenge:', error);
        socket.emit('challengeError', { message: 'Failed to respond to challenge' });
      }
    });

    socket.on('getChallengerStats', async (challengerUserId, callback) => {
      try {
        console.log(`📊 Getting stats for challenger: ${challengerUserId}`);
        
        const stats = await Stats.findOne({ userId: challengerUserId });
        const playerLevel = await PlayerLevel.findOne({ userId: challengerUserId });
        
        if (!stats) {
          return callback({ error: 'Stats not found' });
        }
        
        const statsData = {
          level: playerLevel ? playerLevel.level : 1,
          stats: {
            strength: stats.strength || 10,
            agility: stats.agility || 10,
            intuition: stats.intuition || 10,
            endurance: stats.endurance || 10,
            totalWins: stats.totalWins || 0,
            totalLosses: stats.totalLosses || 0
          }
        };
        
        callback(statsData);
        
      } catch (error) {
        console.error('Error getting challenger stats:', error);
        callback({ error: 'Failed to get stats' });
      }
    });

    // Cleanup challenges when player disconnects
    socket.on('disconnect', () => {
      this.activeChallenges.forEach((challenge, key) => {
        if (challenge.challengerId === socket.id || challenge.opponentId === socket.id) {
          this.activeChallenges.delete(key);
          const otherPlayerId = challenge.challengerId === socket.id ? challenge.opponentId : challenge.challengerId;
          this.io.to(otherPlayerId).emit('challengeCancelled', { 
            challengeId: key,
            reason: 'Player disconnected'
          });
        }
      });
    });
  }
}

module.exports = ChallengeHandlers;