const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'StrandsBotClient.js',
  level: config.get('logLevel'),
});
const dayjs = require('dayjs');
const fetch = require('node-fetch-native');
const {StrandsGame} = require('./data/StrandsGame');
const {StrandsScore} = require('./data/StrandsScore');
const {StrandsSummaryCommand, StrandsWhoLeftCommand} = require('./commands');


const INSULT_USERNAME = config.get('insultUserName');
const STRANDS_REGEX = /Strands.*#[0-9,]+.*\n.*\n[💡🔵🟡\n]+/g;
/**
 * Main Bot Class to handle events
 */
class StrandsBotClient {
  /**
   * Constructor
   */
  constructor() {
    this.strandsGame = StrandsGame.getInstance();
    this.strandsScore = StrandsScore.getInstance();
    this.summaryCommand = StrandsSummaryCommand.getInstance();
    this.whoLeftCommand = StrandsWhoLeftCommand.getInstance();
  }

  /**
   * Adds a new Score to the database. Scores already added will be ignored.
   * @param {*} message discord message containing a strands score.
   */
  async _addStrandsScore(message) {
    const found = message?.content?.match(STRANDS_REGEX);
    const strands = found[0];
    const subStrands = strands.substring(strands.indexOf('#')+1);
    const strandsNumber = Number(subStrands.split(/\r?\n/)[0].replaceAll(',', ''));
    const guildId = message.channel.guildId;
    const channelId = message.channel.id;

    if (!(await this.strandsGame.getStrandsGame(strandsNumber))) {
      await this.strandsGame.createStrandsGame(strandsNumber, message.createdTimestamp);
    }
    let newPlay = true;
    if (!(await this.strandsScore.getScore(message.author.username, strandsNumber, guildId, channelId))) {
      await this.strandsScore.createScore(message.author.username, message.author.tag, message.author.id, strands, strandsNumber, message.createdTimestamp, guildId, channelId);
    } else {
      newPlay = false;
    }

    const playScore = (await this.strandsScore.getScore(message.author.username, strandsNumber, guildId, channelId))?.score;

    const reactions = this._convertScoreToEmojiList(playScore, message);

    try {
      await Promise.all(reactions.map((emoji) => message.react(emoji)));
    } catch (ex) {
      logger.error('unable to react to messaage');
      logger.error(ex);
    }

    const latestGame = await this.strandsGame.getLatestGame();

    const currentGame = await this.strandsGame.getStrandsGame(latestGame);
    if (!currentGame?.jsongameinfo) {
      const day = dayjs().format('YYYY-MM-DD');
      const url = `https://www.nytimes.com/svc/strands/v2/${day}.json`;
      const solution = await fetch(url, {method: 'Get'})
          .then((res) => res?.json())
          .catch((ex) => {
            logger.error(ex);
            return null;
          });
      if (solution?.spangram && solution?.spangram?.trim()) {
        await this.strandsGame.addGameInfo(strandsNumber, solution);
      } else {
        logger.error('Unable to get solution');
        logger.error(solution);
      }
    }

    // Only post additional messages if game played was for the latest game and not bot post.
    if (strandsNumber === Number(latestGame) && newPlay && message.author.username !== 'Strands Bot') {
      const totalPlayes = await this.strandsScore.getTotalPlayers(guildId, channelId);
      const gamePlayers = await this.strandsScore.getPlayersForGame(latestGame, guildId, channelId);
      const remaining = totalPlayes.filter((player) => !gamePlayers.includes(player));
      logger.info(`Remaining players: ${remaining}`);
      if (!remaining.length) {
        await this.summaryCommand.execute(null, message.channel);
      } else if (remaining.length === 1) {
        if (remaining[0] === INSULT_USERNAME) {
          await this.whoLeftCommand.execute(null, message.channel);
        }
      }
    }
  }

  /**
   * Converts a score to emojis.
   * @param {*} score the score of the play
   * @param {*} message the message to add the score too.
   * @return {*} the emojis to react with.
   */
  _convertScoreToEmojiList(score, message) {
    let containsOne = false;
    const emojiArray = [];
    (score + '').split('').forEach((part) => {
      switch (part) {
        case '0':
          emojiArray.push('0️⃣');
          break;
        case '1':
          if (!containsOne) {
            emojiArray.push('1️⃣');
          } else {
            emojiArray.push('🇮');
          }
          containsOne = true;
          break;
        case '2':
          emojiArray.push('2️⃣');
          break;
        case '3':
          emojiArray.push('3️⃣');
          break;
        case '4':
          emojiArray.push('4️⃣');
          break;
        case '5':
          emojiArray.push('5️⃣');
          break;
        case '6':
          emojiArray.push('6️⃣');
          break;
        case '7':
          emojiArray.push('7️⃣');
          break;
        case '8':
          emojiArray.push('8️⃣');
          break;
        case '9':
          emojiArray.push('9️⃣');
          break;
        default:
          emojiArray.push('⁉️');
          break;
      }
    });

    if (score === 1) {
      const reactionEmoji2 = message.guild.emojis.cache.find((emoji) => emoji.name === 'andy_ooh');
      if (reactionEmoji2) {
        emojiArray.push(reactionEmoji2);
      } else {
        emojiArray.push('🥳');
      }
    }

    return emojiArray;
  }

  /**
   * Discord Edit Event Handler
   * @param {*} oldMessage The discord message before the edit.
   * @param {*} newMessage The discord message after the edit.
   */
  async editEvent(oldMessage, newMessage) {
    logger.info('edit Event.');
    logger.info(oldMessage?.content);
    logger.info(newMessage?.content);
    const guildId = newMessage.channel.guildId;
    const channelId = newMessage.channel.id;
    const found = newMessage?.content?.match(STRANDS_REGEX);
    if (found && found.length) {
      const strands = found[0];
      const subStrands = strands.substring(strands.indexOf('#')+1);
      const strandsNumber = Number(subStrands.split(/\r?\n/)[0].replaceAll(',', ''));
      if ((await this.strandsScore.getScore(newMessage.author.username, strandsNumber, guildId, channelId))) {
        await newMessage.lineReply('I saw that, Edited Strands Score Ignored.');
      } else {
        await this._addStrandsScore(newMessage);
        await newMessage.lineReply('I got you, Edited Strands Score Counted.');
      }
    }
  }
  /**
   * Discord Message Handler
   * @param {*} message new message to process.
   * @return {*}
   */
  async messageHandler(message) {
    logger.info(message);
    if (message.content.startsWith(`!${this.whoLeftCommand.data.name}`) || message.content.startsWith(`/${this.whoLeftCommand.data.name}`)) {
      message.delete();
      await this.whoLeftCommand.execute(null, message.channel);
      return;
    }
    if (message.content.startsWith(`!${this.summaryCommand.data.name}`) || message.content.startsWith(`/${this.summaryCommand.data.name}`)) {
      message.delete();
      await this.summaryCommand.execute(null, message.channel);
      return;
    }
    const found = message?.content?.match(STRANDS_REGEX);
    if (found && found.length) {
      await this._addStrandsScore(message);
    }
  }
}

module.exports = {StrandsBotClient};
