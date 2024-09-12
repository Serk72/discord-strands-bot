const {Pool} = require('pg');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'ChanneManager.js',
  level: config.get('logLevel'),
});
const DATABASE_CONFIG = config.get('postgres');
/**
 * Data Access Layer for the AIMessages Table
 */
class ChanneManager {
  pool;
  static _instance;
  /**
   * Singleton instance.
   * @return {ChanneManager} the singleton instance
   */
  static getInstance() {
    if (!ChanneManager._instance) {
      ChanneManager._instance = new ChanneManager();
    }
    return ChanneManager._instance;
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
    ChanneManager (
      Id serial PRIMARY KEY,
      GuildId VARCHAR (255),
      ChannelId VARCHAR (255),
      monitor BOOLEAN,
      autoPost BOOLEAN);`;
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
   * Gets a message history
   * @param {*} messageName name to lookup.
   * @return {*} list of messages or null
   */
  async getMessageList(messageName) {
    try {
      const results = await this.pool.query('SELECT aiMessages FROM ChanneManager WHERE messageName = $1', [messageName]);
      return results?.rows?.[0]?.aimessages?.messages;
    } catch (ex) {
      logger.error(ex);
      throw ex;
    }
  }

  /**
   * Stores the messages for an AI game play
   * @param {*} messageName messageName to look up.
   * @param {*} messages message array for the game.
   */
  async updateMessageList(messageName, messages) {
    if (!(await this.getMessageList(messageName))?.length) {
      await this.createMessageList(messageName, messages);
    }
    await this.pool.query(`UPDATE ChanneManager SET aiMessages = $1 WHERE messageName = $2`,
        [{messages}, messageName]);
  }

  /**
   * Finds the latest game recorded in the database.
   * @param {*} messageName name to lookup.
   * @param {*} messages message array for the game.
   * @return {*} the latest game recorded in the database.
   */
  async createMessageList(messageName, messages) {
    await this.pool.query(`INSERT INTO ChanneManager(messageName, aimessages) VALUES ($1, $2)`, [messageName, {messages}]);
    return true;
  }
}
module.exports = {ChanneManager};
