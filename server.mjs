// @ts-check
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

// Constants
const CONFIG = {
    PORT: process.env.PORT || 3000,
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 8,
    DEFAULT_MAX_PLAYERS: 4
};

// Types (using JSDoc for type checking)
/**
 * @typedef {Object} GameState
 * @property {number} maxPlayers - Maximum number of players allowed
 * @property {boolean} isAcceptingPlayers - Whether new players can join
 * @property {boolean} isAcceptingBuzzers - Whether buzzer inputs are accepted
 * @property {Map<string, string>} players - Map of socket IDs to player names
 */

/**
 * @typedef {Object} GameSettings
 * @property {number} maxPlayers - Maximum number of players allowed
 */

class GameServer {
    /** @type {GameState} */
    #gameState;
    /** @type {Server} */
    #io;

    constructor(io) {
        this.#io = io;
        this.#gameState = {
            maxPlayers: CONFIG.DEFAULT_MAX_PLAYERS,
            isAcceptingPlayers: true,
            isAcceptingBuzzers: true,
            players: new Map()
        };
    }

    /**
     * Converts the players Map to an array of player objects for client updates
     * @returns {Array<{name: string, buzzed: boolean}>}
     */
    #getPlayersArray() {
        return Array.from(this.#gameState.players.entries()).map(([id, name]) => ({
            name,
            buzzed: false // You might want to track this state per player
        }));
    }

    /**
     * Validates game settings
     * @param {GameSettings} settings
     * @returns {boolean}
     */
    validateSettings(settings) {
        return settings.maxPlayers >= CONFIG.MIN_PLAYERS &&
            settings.maxPlayers <= CONFIG.MAX_PLAYERS;
    }

    /**
     * Updates game settings if valid
     * @param {GameSettings} settings
     * @returns {boolean} Whether the update was successful
     */
    updateSettings(settings) {
        if (!this.validateSettings(settings)) {
            return false;
        }
        this.#gameState.maxPlayers = settings.maxPlayers;
        this.#io.emit('settings', settings);
        return true;
    }

    /**
     * Handles player login
     * @param {string} socketId
     * @param {string} name
     * @returns {boolean}
     */
    handleLogin(socketId, name) {
        if (!this.#gameState.isAcceptingPlayers ||
            this.#gameState.players.size >= this.#gameState.maxPlayers) {
            return false;
        }

        console.log(`Player ${name} logged in`);
        this.#gameState.players.set(socketId, name);

        // Emit updated player list to all clients
        this.#io.emit('playerUpdate', this.#getPlayersArray());

        return true;
    }

    /**
     * Handles player disconnect
     * @param {string} socketId
     */
    handleDisconnect(socketId) {
        this.#gameState.players.delete(socketId);
        // Emit updated player list after disconnect
        this.#io.emit('playerUpdate', this.#getPlayersArray());
    }

    /**
     * Handles buzzer input
     * @param {string} playerId
     * @returns {boolean}
     */
    handleBuzz(playerId) {
        if (!this.#gameState.isAcceptingBuzzers ||
            !this.#gameState.players.has(playerId)) {
            return false;
        }

        this.#gameState.isAcceptingBuzzers = false;
        this.#io.emit('buzz', this.#gameState.players.get(playerId));
        return true;
    }

    /**
     * Resets buzzer state
     */
    resetBuzzer() {
        this.#gameState.isAcceptingBuzzers = true;
        this.#io.emit('buzzerReset');
    }
}

// Setup Express and Socket.io
const app = express();
const server = createServer(app);
const io = new Server(server, {
    // cors: {
    //     origin: process.env.NODE_ENV === 'development' ? '*' : undefined
    // }
    cors: {
        origin: '*', // Allow all origins
        methods: ['GET', 'POST']
    }
});

// Initialize game server
const gameServer = new GameServer(io);

// Static file serving
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    const isLocalhost = req.ip === '::1' ||
        req.ip === '127.0.0.1' ||
        req.hostname === 'localhost';

    const page = isLocalhost ? 'admin.html' : 'index.html';
    res.sendFile(join(__dirname, page));
});

// Socket.io event handlers
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('chat message', (msg) => {
        if (typeof msg !== 'string') return;
        io.emit('chat message', msg);
    });

    socket.on('login', (name) => {
        if (typeof name !== 'string') return;

        const success = gameServer.handleLogin(socket.id, name);
        if (success) {
            socket.emit('login success', `Welcome, ${name}!`);
        } else {
            socket.emit('login error', 'Unable to join game');
        }
    });

    socket.on('buzz', () => {
        const success = gameServer.handleBuzz(socket.id);
        if (!success) {
            socket.emit('buzz error', 'Buzzer input not accepted');
        }
    });

    socket.on('settings', (settings) => {
        if (!settings || typeof settings.maxPlayers !== 'number') return;

        const success = gameServer.updateSettings(settings);
        if (!success) {
            socket.emit('settings error', 'Invalid settings');
        }
    });

    socket.on('resetBuzzer', () => {
        gameServer.resetBuzzer();
    });

    socket.on('disconnect', () => {
        gameServer.handleDisconnect(socket.id);
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(3000, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:3000`);
});


// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});