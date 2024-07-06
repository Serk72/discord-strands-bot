const {Pool} = require('pg');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'StrandsScore.js',
  level: config.get('logLevel'),
});
const DATABASE_CONFIG = config.get('postgres');
/**
 * Data Access layer for the StrandsScore Table.
 */
class StrandsScore {
  pool;
  static _instance;
  /**
   * Singleton instance.
   * @return {Score} the singleton instance
   */
  static getInstance() {
    if (!StrandsScore._instance) {
      StrandsScore._instance = new StrandsScore();
    }
    return StrandsScore._instance;
  }
  /**
   * Constructor.
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
    StrandsScore (
      Id serial PRIMARY KEY,
      StrandsGame INT NOT NULL,
      UserName VARCHAR (255),
      UserTag VARCHAR (255),
      UserId  VARCHAR (255),
      Message VARCHAR (255),
      Score INT,
      GuildId VARCHAR (255),
      ChannelId VARCHAR (255),
      Date TIMESTAMP);`;
    this.pool.query(tablesSQL, [], (err, res) => {
      if (err) {
        logger.error(err);
        return;
      }
    });
    this.pool.on('error', (err, client) => {
      logger.error(`Unexpected error on idle client ${err}`);
      process.exit(-1);
    });
  }

  /**
   * Gets the users score for the given wordle game if it exists.
   * @param {*} user The user to find the score for.
   * @param {*} strandsGame The Strands game number to look for.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} The Score entry if it exists.
   */
  async getScore(user, strandsGame, guildId, channelId) {
    const results = await this.pool.query(`
    SELECT * FROM 
    StrandsScore Where
     UserName = $1
     AND StrandsGame = $2
     AND GuildId = $3
     AND ChannelId = $4`, [user, strandsGame, guildId, channelId]);
    return results?.rows?.[0];
  }

  /**
   * Gets all existing scores.
   */
  async getAllScores() {
    const results = await this.pool.query(`
    SELECT * FROM 
    StrandsScore`);
    return results?.rows;
  }

  /**
   * updates a Strands score.
   * @param {*} id Strands score database id.
   * @param {*} strandsMessage Strands message to update metadata for.
   */
  async updateScore(id, strandsMessage) {
    const strandsScore = this._processScore(strandsMessage);
    await this.pool.query(`
    UPDATE
    strandsScore SET Message = $1, Score = $2 WHERE id = $3`,
    [strandsMessage, strandsScore.score, id]);
  }

  /**
   * Reprocesses all scores to allow for reprocess on changes.
   */
  async reprocessScores() {
    const scores = await this.getAllScores();
    logger.info(`processing ${scores.length} scores.`);
    await Promise.all(scores.map((score) => {
      return this.updateScore(score.id, score.message.replaceAll('\\n', '\n'));
    }));
    logger.info(`finished processing.`);
  }

  /**
   * Gets all the usernames and scores for a game.
   * @param {*} strandsGame Strands game number to check.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames and scores in order.
   */
  async getGameScores(strandsGame, guildId, channelId) {
    const results = await this.pool.query('SELECT UserName, Score FROM StrandsScore WHERE StrandsGame = $1 AND GuildId = $2 AND ChannelId = $3 ORDER By Score ASC, Date', [strandsGame, guildId, channelId]);
    return results?.rows;
  }

  /**
   * Processes a score object out of a Strands message.
   * @param {*} strandsMessage Strands String in the format of
Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡
   * @return {*} object containing the Strands completed, plays, and calculated score.
   */
  _processScore(strandsMessage) {
    const numberOfHints = (strandsMessage.match(/💡/g) || []).length;
    const spangramGuess = (strandsMessage.match(/💡|🔵|🟡/g) || []).indexOf('🟡') + 1;

    const score = numberOfHints + spangramGuess;

    return {score};
  }

  /**
   * Adds a new Score to the database.
   * @param {*} user User to store the score for.
   * @param {*} userTag User tag for the user.
   * @param {*} userId User ID.
   * @param {*} strandsMessage strands String in the format of
Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡
   * @param {*} strandsGame strands game number to store.
   * @param {*} timestamp Timestamp of when the score was recorded.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   */
  async createScore(user, userTag, userId, strandsMessage, strandsGame, timestamp, guildId, channelId) {
    const strandsScore = this._processScore(strandsMessage);
    await this.pool.query(`
    INSERT INTO 
    StrandsScore(StrandsGame, UserName, UserTag, UserId, Message, Score, Date, GuildId, ChannelId)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), $8, $9)`, [strandsGame, user, userTag, userId, strandsMessage, strandsScore.score, timestamp/1000, guildId, channelId]);
  }

  /**
   * Gets a list of all usernames in the Score table.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames in the Score table.
   */
  async getTotalPlayers(guildId, channelId) {
    const results = await this.pool.query(`SELECT DISTINCT(UserName) FROM StrandsScore WHERE GuildId = $1 AND ChannelId = $2 AND UserName != 'Strands Bot' AND Date > now() - interval '7 days'`, [guildId, channelId]);
    return results?.rows?.map((row) => row.username);
  }

  /**
   * Gets all the usernames that have played the Strands game number.
   * @param {*} strandsGame Strands game number to check.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames that have played the game number.
   */
  async getPlayersForGame(strandsGame, guildId, channelId) {
    const results = await this.pool.query(`SELECT DISTINCT(UserName) FROM StrandsScore WHERE StrandsGame = $1 AND GuildId = $2 AND ChannelId = $3 AND UserName != 'Strands Bot' AND Date > now() - interval '7 days'`, [strandsGame, guildId, channelId]);
    return results?.rows?.map((row) => row.username);
  }

  /**
   * Gets all the userInfo that have played the Strands game number.
   * @param {*} strandsGame Strands game number to check.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} list of all usernames that have played the game number.
   */
  async getPlayerInfoForGame(strandsGame, guildId, channelId) {
    const results = await this.pool.query(`SELECT * FROM StrandsScore WHERE StrandsGame = $1 AND GuildId = $2 AND ChannelId = $3 AND UserName != 'Strands Bot'`, [strandsGame, guildId, channelId]);
    return results?.rows;
  }

  /**
   * Gets overall summary data for all users.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} overall summary data for all users.
   */
  async getPlayerSummaries(guildId, channelId) {
    const results = await this.pool.query(`
    SELECT * FROM (SELECT 
      COUNT(*) as games, 
      SUM(Score) as totalscore, 
      ROUND(CAST(SUM(Score)::float/COUNT(*)::float as numeric), 2) AS Average,  
      username
    FROM StrandsScore 
    WHERE
      GuildId = $1 AND ChannelId = $2
    GROUP BY Username 
    ORDER BY Average ASC) as summary`, [guildId, channelId]);
    return results?.rows;
  }

  /**
   * Gets last 7 day summary for all users.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} last 7 day summary for all users.
   */
  async getLast7DaysSummaries(guildId, channelId) {
    const results = await this.pool.query(`
    SELECT 
      COUNT(*) as games, 
      SUM(Score) as totalscore, 
      ROUND(CAST(SUM(Score)::float/COUNT(*)::float as numeric), 2) AS Average, 
      username
    FROM StrandsScore 
    WHERE 
      Date > now() - interval '7 days' AND GuildId = $1 AND ChannelId = $2
    GROUP BY Username
    ORDER BY Average ASC`, [guildId, channelId]);
    return results?.rows;
  }

  /**
   * Gets last month summaries for all users.
   * @param {*} guildId Guild Id for the server the score was posted too.
   * @param {*} channelId Channel id the score was posted too.
   * @return {*} last month summaries for all users.
   */
  async getLastMonthSummaries(guildId, channelId) {
    const results = await this.pool.query(`
    SELECT * FROM (SELECT 
      COUNT(*) as games, 
      SUM(Score) as totalscore, 
      ROUND(CAST(SUM(Score)::float/COUNT(*)::float as numeric), 2) AS Average, 
      username,
      to_Char((now() - interval '1 month')::date, 'Month') AS lastmonth 
    FROM StrandsScore s JOIN StrandsGAME w ON w.StrandsGAME = s.StrandsGAME
    WHERE
      EXTRACT('MONTH' FROM w.Date) = EXTRACT('MONTH' FROM Now() - interval '1 month')
      AND EXTRACT('YEAR' FROM w.Date) = EXTRACT('YEAR' FROM Now() - interval '1 month')
      AND GuildId = $1 AND ChannelId = $2
    GROUP BY UserName
    ORDER BY Average ASC) AS summary WHERE games >= 10`, [guildId, channelId]);
    return results?.rows;
  }
}

module.exports = {StrandsScore};
