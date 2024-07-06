const {Pool} = require('pg');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'StrandsGame.js',
  level: config.get('logLevel'),
});
const DATABASE_CONFIG = config.get('postgres');
/**
 * Data Access Layer for the StrandsGame Table
 */
class StrandsGame {
  pool;
  static _instance;
  /**
   * Singleton instance.
   * @return {StrandsGame} the singleton instance
   */
  static getInstance() {
    if (!StrandsGame._instance) {
      StrandsGame._instance = new StrandsGame();
    }
    return StrandsGame._instance;
  }
  /**
   * Constructor
   */
  constructor() {
    this.pool = new Pool({
      user: DATABASE_CONFIG.user,
      host: DATABASE_CONFIG.host,
      database: DATABASE_CONFIG.database,
      password: DATABASE_CONFIG.password,
      port: DATABASE_CONFIG.port,
    });
    const tablesSQL = `CREATE TABLE IF NOT EXISTS 
    StrandsGame (
      Id serial PRIMARY KEY,
      StrandsGame INT NOT NULL UNIQUE,
      Spangram VARCHAR (255),
      Clue VARCHAR (255),
      JsonGameInfo JSONB,
      themeWords JSONB,
      SummaryPosted BOOLEAN,
      Date TIMESTAMP);`;
    this.pool.query(tablesSQL, (err, res) => {
      if (err) {
        logger.error(err);
        return;
      }
    });
    this.pool.on('error', (err, client) => {
      logger.error(`Unexpected error on idle client ${JSON.stringify(err)}`);
      process.exit(-1);
    });
  }

  /**
   * Gets a Strands game from the database if it exists.
   * @param {*} strandsGame game number to look up.
   * @return {*} the Strands game row if it exits or null.
   */
  async getStrandsGame(strandsGame) {
    try {
      const results = await this.pool.query('SELECT * FROM StrandsGame WHERE StrandsGame = $1', [strandsGame]);
      return results?.rows?.[0];
    } catch (ex) {
      logger.error(ex);
      throw ex;
    }
  }

  /**
   * Finds the latest game recorded in the database.
   * @return {*} the latest game recorded in the database.
   */
  async getLatestGame() {
    const results = await this.pool.query('SELECT * FROM StrandsGame ORDER BY StrandsGame DESC LIMIT 1', []);
    return results?.rows?.[0]?.strandsgame;
  }

  /**
   * Gets all past game json info
   * @param {number} gameToExclude number to exclude from results.
   * @return {*} Gets all pasxt game json info
   */
  async getAllPastGamesJSON(gameToExclude) {
    const results = await this.pool.query('SELECT JsonGameInfo FROM StrandsGame WHERE StrandsGame != $1 ORDER BY StrandsGame DESC', [gameToExclude]);
    return results?.rows.map((row) => row.jsongameinfo);
  }

  /**
   * Gets latest game json info.
   * @return {*} Gets latest game json info.
   */
  async getLatestGamesJSON() {
    const results = await this.pool.query('SELECT JsonGameInfo FROM StrandsGame ORDER BY StrandsGame DESC LIMIT 1', []);
    return results?.rows?.[0]?.jsongameinfo;
  }

  /**
   * Finds the latest game recorded in the database.
   * @return {*} the latest game recorded in the database.
   */
  async getLatestGameSummaryPosted() {
    const results = await this.pool.query('SELECT * FROM StrandsGame ORDER BY StrandsGame DESC LIMIT 1', []);
    return results?.rows?.[0]?.summaryposted;
  }

  /**
   * Creates a Strands game entry.
   * @param {*} strandsGame The game number to add.
   * @param {*} timestamp The timestamp of when the game was added.
   */
  async createStrandsGame(strandsGame, timestamp) {
    await this.pool.query(`INSERT INTO StrandsGame(StrandsGame, Date) VALUES ($1, to_timestamp($2))`, [strandsGame, timestamp / 1000]);
  }

  /**
   * Gets all Strands game dates.
   */
  async getStrandsGames() {
    const results = await this.pool.query(`SELECT to_char(date, 'yyyy-MM-dd') as day FROM StrandsGame`, []);
    return results.rows;
  }

  /**
   * Adds the solution to the Strands game.
   * @param {*} game strandss Game number.
   * @param {*} jsonGameInfo solution to the Strands.
   */
  async addGameInfo(game, jsonGameInfo) {
    const spangram = jsonGameInfo.spangram;
    const clue = jsonGameInfo.clue;
    const themeWords = {themeWords: jsonGameInfo.themeWords};
    await this.pool.query(`UPDATE StrandsGame SET JsonGameInfo = $1, Spangram = $2, Clue = $3, themeWords = $4 WHERE StrandsGame = $5`,
        [jsonGameInfo, spangram, clue, themeWords, game]);
  }

  /**
   * Marks the summary as posted.
   * @param {*} game Strands Game number.
   */
  async summaryPosted(game) {
    await this.pool.query(`UPDATE StrandsGame SET SummaryPosted = TRUE WHERE StrandsGame = $1`, [game]);
  }
}
module.exports = {StrandsGame};
