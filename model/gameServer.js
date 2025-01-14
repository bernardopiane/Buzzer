import { CONFIG } from '../config.js';
import { Player } from './player.js';

// Types (using JSDoc for type checking)
/**
 * @typedef {Object} GameState
 * @property {number} maxPlayers - Maximum number of players allowed
 * @property {boolean} isAcceptingPlayers - Whether new players can join
 * @property {boolean} isAcceptingBuzzers - Whether buzzer inputs are accepted
 * @property {Map<string, Player>} players - Map of socket IDs to Player instances
 */

/**
 * @typedef {Object} GameSettings
 * @property {number} maxPlayers - Maximum number of players allowed
 */

export class GameServer {
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
            players: new Map(),
        };
    }

    /**
     * Converts the players Map to an array of player objects for client updates
     * @returns {Array<{name: string, buzzed: boolean}>}
     */
    #getPlayersArray() {
        return Array.from(this.#gameState.players.values()).map((player) => player.toJSON());
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
        const player = new Player(name);
        this.#gameState.players.set(socketId, player);

        this.#io.emit('playerUpdate', this.#getPlayersArray());

        return true;
    }

    /**
     * Handles player disconnect
     * @param {string} socketId
     */
    handleDisconnect(socketId) {
        this.#gameState.players.delete(socketId);
        this.#io.emit('playerUpdate', this.#getPlayersArray());
    }

    /**
     * Handles buzzer input
     * @param {string} playerId
     * @returns {boolean}
     */
    handleBuzz(playerId) {
        const player = this.#gameState.players.get(playerId);
        if (!this.#gameState.isAcceptingBuzzers || !player) {
            return false;
        }

        player.buzz();
        this.#gameState.isAcceptingBuzzers = false;
        this.#io.emit('buzz', player.name);
        return true;
    }

    /**
     * Resets buzzer state
     */
    resetBuzzer() {
        this.#gameState.players.forEach((player) => player.resetBuzz());
        this.#gameState.isAcceptingBuzzers = true;
        this.#io.emit('buzzerReset');
    }

    changeScore(name, amount) {
        const player = Array.from(this.#gameState.players.values()).find(p => p.name === name);
        console.log(player);
        if (!player) return;
        player.setScore(amount);
        this.#io.emit('playerUpdate', this.#getPlayersArray());
    }


}


