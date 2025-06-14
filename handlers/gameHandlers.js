// handlers/gameHandlers.js - Updated with GameUtils Integration
const { Stats, Inventory, PlayerLevel } = require('../models');

class GameHandlers {
  constructor(io, activeGames, connectedPlayers, gameUtils) {
    this.io = io;
    this.activeGames = activeGames;
    this.connectedPlayers = connectedPlayers;
    this.gameUtils = gameUtils;
  }

  registerHandlers(socket) {
    console.log(`🎮 Registering game handlers for ${socket.user.username}`);

    // Note: joinGame and makeMove are handled in server.js for bot integration
    // This class provides helper methods

    socket.on('leaveGame', (gameId) => {
      try {
        console.log(`🚪 ${socket.user.username} leaving game: ${gameId}`);
        
        socket.leave(gameId);
        
        const game = this.activeGames.get(gameId);
        if (game && game.players[socket.id]) {
          // Notify other players
          socket.to(gameId).emit('opponentLeft', {
            playerId: socket.id,
            playerName: socket.user.username
          });
          
          // End the game if it was in progress
          if (!game.waitingForPlayers) {
            const remainingPlayers = Object.keys(game.players).filter(id => id !== socket.id);
            if (remainingPlayers.length > 0) {
              this.gameUtils.endGame(gameId, remainingPlayers[0]);
            } else {
              this.activeGames.delete(gameId);
            }
          } else {
            // Just remove player from waiting game
            delete game.players[socket.id];
            if (Object.keys(game.players).length === 0) {
              this.activeGames.delete(gameId);
            }
          }
        }
        
      } catch (error) {
        console.error('Error leaving game:', error);
      }
    });
  }

  // --- FIXED: Helper method for joining games no longer starts the game itself ---
  async handleJoinGame(socket, gameId) {
    try {
      console.log(`🎮 ${socket.user.username} joining game (handler): ${gameId}`);
      
      // Create game if it doesn't exist
      if (!this.activeGames.has(gameId)) {
        console.log(`Creating new game: ${gameId}`);
        
        const newGame = {
          id: gameId,
          players: {},
          currentRound: 0,
          turnTimer: null,
          turnTime: 30,
          moves: {},
          waitingForPlayers: true,
          createdAt: Date.now()
        };

        this.activeGames.set(gameId, newGame);
      }

      // Join the game room
      socket.join(gameId);
      
      const game = this.activeGames.get(gameId);
      
      // If player isn't in game yet, add them
      if (!game.players[socket.id]) {
        const stats = await Stats.findOne({ userId: socket.user._id });
        const inventory = await Inventory.findOne({ userId: socket.user._id });
        const playerLevel = await PlayerLevel.findOne({ userId: socket.user._id });
        
        game.players[socket.id] = await this.gameUtils.createPlayerGameData(socket, stats, inventory, playerLevel);
      }

      // Mark player as ready
      game.players[socket.id].ready = true;

      console.log(`Game ${gameId} now has ${Object.keys(game.players).length} players`);

      // The game-starting logic is now handled in server.js after the bot (if any) also joins.
      // This function's responsibility is now just to add the player.
      
    } catch (error) {
      console.error('Error joining game in handler:', error);
      socket.emit('gameError', { message: 'Failed to join game' });
    }
  }

  // Helper method for making moves (called from server.js)
  async handleMakeMove(socket, data) {
    try {
      const { gameId, attackArea, blockArea } = data;
      console.log(`🎯 Move from ${socket.user.username}: attack=${attackArea}, block=${blockArea}`);
      
      const game = this.activeGames.get(gameId);
      if (!game) {
        socket.emit('invalidMove', { message: 'Game not found' });
        return;
      }

      if (!game.players[socket.id]) {
        socket.emit('invalidMove', { message: 'You are not in this game' });
        return;
      }

      if (game.moves[socket.id]) {
        socket.emit('invalidMove', { message: 'You have already made a move this round' });
        return;
      }

      // Store the move
      game.moves[socket.id] = {
        attackArea: attackArea,
        blockArea: blockArea,
        timestamp: Date.now(),
        auto: false
      };

      console.log(`✅ Move recorded for ${socket.user.username}`);

      // Confirm move received
      socket.emit('moveReceived', { success: true });
      
      // Notify other players that this player made a move
      socket.to(gameId).emit('opponentMadeMove', {
        playerId: socket.id,
        playerName: socket.user.username
      });

      // Check if all players have made their moves
      const playerIds = Object.keys(game.players);
      const moveIds = Object.keys(game.moves);
      
      console.log(`Moves received: ${moveIds.length}/${playerIds.length}`);

      if (moveIds.length >= playerIds.length) {
        // All moves received, process the round
        console.log(`🎯 All moves received for game ${gameId}, processing round ${game.currentRound}`);
        
        // Clear the turn timer
        if (game.turnTimer) {
          clearTimeout(game.turnTimer);
          game.turnTimer = null;
        }
        
        // Notify all players that moves are being processed
        this.io.to(gameId).emit('allMovesMade', { message: 'Processing round...' });
        
        // Process the round after a short delay
        setTimeout(() => {
          this.gameUtils.processRound(gameId);
        }, 1000);
      }

    } catch (error) {
      console.error('Error processing move:', error);
      socket.emit('invalidMove', { message: 'Failed to process move' });
    }
  }
}

module.exports = GameHandlers;