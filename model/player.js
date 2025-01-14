/**
 * Class representing a player in the game
 */
export class Player {
    /**
     * Constructor for Player class
     * @param {string} name - name of the player
     */
    constructor(name) {
        this.name = name;
        this.score = 0;
        this.buzzed = false;
    }

    /**
     * Buzzes the player
     */
    buzz() {
        this.buzzed = true;
    }

    /**
     * Resets the buzz state of the player
     */
    resetBuzz() {
        this.buzzed = false;
    }

    /**
     * Increments the score of the player
     * @param {number} amount - amount to increment the score by
     */
    setScore(amount) {
        this.score = amount;
    }

    /**
     * Returns the player as an object
     * @returns {Object} player object
     */
    toJSON() {
        return {
            name: this.name,
            score: this.score,
            buzzed: this.buzzed,
        };
    }
}

