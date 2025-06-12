// handlers/gameHandlers.js
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

    socket.on('joinGame', async (gameId) => {
      try {
        console.log(`🎮 ${socket.user.username} joining game: ${gameId}`);
        
        // Create game if it doesn't exist
        if (!this.activeGames.has(gameId)) {
          console.log(`Creating new game: ${gameId}`);
          
          // Get player data
          const playerData = this.connectedPlayers.get(socket.id);
          if (!playerData) {
            socket.emit('gameError', { message: 'Player data not found' });
            return;
          }

          // Get full player stats and equipment
          const stats = await Stats.findOne({ userId: socket.user._id });
          const inventory = await Inventory.findOne({ userId: socket.user._id });
          const playerLevel = await PlayerLevel.findOne({ userId: socket.user._id });

          // Create player game data with proper stats
          const gamePlayerData = await this.gameUtils.createPlayerGameData(socket, stats, inventory, playerLevel);

          const newGame = {
            id: gameId,
            players: {
              [socket.id]: gamePlayerData
            },
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
          // Get this player's data
          const stats = await Stats.findOne({ userId: socket.user._id });
          const inventory = await Inventory.findOne({ userId: socket.user._id });
          const playerLevel = await PlayerLevel.findOne({ userId: socket.user._id });
          
          game.players[socket.id] = await this.gameUtils.createPlayerGameData(socket, stats, inventory, playerLevel);
        }

        // Mark player as ready
        game.players[socket.id].ready = true;

        console.log(`Game ${gameId} now has ${Object.keys(game.players).length} players`);

        // Check if we have 2 players and both are ready
        const playerCount = Object.keys(game.players).length;
        const readyCount = Object.values(game.players).filter(p => p.ready).length;

        if (playerCount >= 2 && readyCount >= 2) {
          // Start the game
          game.waitingForPlayers = false;
          game.currentRound = 0; // Will be incremented to 1 in startRound
          
          console.log(`🎮 Starting game ${gameId} with players:`, Object.values(game.players).map(p => p.username));
          
          // Send game started event to all players
          this.io.to(gameId).emit('gameStarted', {
            gameState: {
              ...game,
              players: game.players
            }
          });
          
          // Start first round after a short delay
          setTimeout(() => {
            this.gameUtils.startRound(gameId);
          }, 2000);
          
        } else {
          // Send current game state
          socket.emit('gameStarted', {
            gameState: {
              ...game,
              players: game.players
            }
          });
        }

      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('gameError', { message: 'Failed to join game' });
      }
    });

    socket.on('makeMove', async (data) => {
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
    });

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
}

module.exports = GameHandlers;