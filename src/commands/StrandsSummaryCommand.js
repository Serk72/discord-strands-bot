const {SlashCommandBuilder} = require('discord.js');
const {StrandsScore} = require('../data/StrandsScore');
const fetch = require('node-fetch-native');
const {StrandsGame} = require('../data/StrandsGame');
const AsciiTable = require('ascii-table');
const config = require('config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'StrandsSummaryCommand.js',
  level: config.get('logLevel'),
});
const FOOTER_MESSAGE = config.get('footerMessage');
const USER_TO_NAME_MAP = config.get('userToNameMap');

/**
 * Command for dispalying summary table for wordle averages.
 */
class StrandsSummaryCommand {
  static _instance;
  /**
   * Singleton instance.
   * @return {StrandsSummaryCommand} the singleton instance
   */
  static getInstance() {
    if (!StrandsSummaryCommand._instance) {
      StrandsSummaryCommand._instance = new StrandsSummaryCommand();
    }
    return StrandsSummaryCommand._instance;
  }
  static data = new SlashCommandBuilder()
      .setName('strandssummary')
      .setDescription('Displays the current summary (message displated each day)');
    /**
     * Constructor.
     */
  constructor() {
    this.strandsScore = StrandsScore.getInstance();
    this.strandsGame = StrandsGame.getInstance();
    this.data = StrandsSummaryCommand.data;
  }

  /**
   * Asyncronusly gets the url for a gif for the provided Strands game.
   * @param {*} latestGame game to find an image of.
   * @return {string} image url to a gif of undefined if none can be retrieved.
   */
  async getImage(latestGame) {
    let imageToSend;
    if (latestGame?.spangram && latestGame?.spangram?.trim() !== '') {
      const tenorApiKey = config.get('tenorApiKey');
      if (tenorApiKey) {
        const url = `https://tenor.googleapis.com/v2/search?key=${tenorApiKey}&q=${latestGame?.spangram}&limit=1`;
        const response = await fetch(url, {method: 'Get'})
            .then((res) => res?.json())
            .catch((ex) => {
              logger.error(ex);
              return null;
            });
        if (response?.results?.[0]?.media_formats?.gif?.url) {
          imageToSend = response?.results?.[0]?.media_formats?.gif?.url;
        } else {
          logger.error('Giphy Invalid Response.');
          logger.error(response);
        }
      } else {
        const giphyApiKey = config.get('giphyApiKey');
        if (giphyApiKey) {
          const url = `http://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${latestGame?.spangram}&limit=1`;
          const response = await fetch(url, {method: 'Get'})
              .then((res) => res?.json())
              .catch((ex) => {
                logger.error(ex);
                return null;
              });

          if (response?.data?.[0]?.url) {
            imageToSend = response?.data?.[0]?.url;
          } else {
            logger.error('Giphy Invalid Response.');
            logger.error(response);
          }
        }
      }
    }
    return imageToSend;
  }

  /**
     * Calculates and sends the overall average summaries for all players in the game.
     * @param {*} interaction discord interaction if specified the command will reply too.
     * @param {*} discordStrandsChannel discord channel to send the command output too, only used if not an interaction.
     */
  async execute(interaction, discordStrandsChannel) {
    let guildId;
    let channelId;
    if (interaction) {
      guildId = interaction.guildId;
      channelId = interaction.channelId;
    } else if (discordStrandsChannel) {
      guildId = discordStrandsChannel.guildId;
      channelId = discordStrandsChannel.id;
    } else {
      logger.error('invalid Summary command call. no interaction or channel');
      throw new Error('Invalid Summary call');
    }

    const [latestGameNumber] = await Promise.all([
      this.strandsGame.getLatestGame(),
    ]);

    const [latestGame, overallSummary, day7Summary, latestScores] = await Promise.all([
      this.strandsGame.getStrandsGame(latestGameNumber),
      this.strandsScore.getPlayerSummaries(guildId, channelId),
      this.strandsScore.getLast7DaysSummaries(guildId, channelId),
      this.strandsScore.getPlayerInfoForGame(latestGameNumber, guildId, channelId),
    ]);
    let imageToSend = this.getImage(latestGame);
    const sum7dayByUser = day7Summary.reduce((acc, sum) => {
      acc[sum.username] = sum;
      return acc;
    }, {});
    const summaryTable = new AsciiTable('Strands Summary');
    summaryTable.setHeading('User', 'GP', 'AS', '7DA');
    overallSummary.forEach((row) => {
      const totalGames = +row.games;
      const day7Summary = {
        gamesPlayed: '',
        average: '',
      };
      if (sum7dayByUser[row.username]) {
        day7Summary.gamesPlayed = sum7dayByUser[row.username].games;
        day7Summary.average = sum7dayByUser[row.username].average;
      }
      summaryTable.addRow(
          USER_TO_NAME_MAP[row.username] || row.username,
          totalGames,
          row.average,
          day7Summary.average);
    });

    const overallLeaderIndex = overallSummary?.[0]?.username === 'Strands Bot' ? 1 : 0;
    const day7LeaderIndex = day7Summary?.[0]?.username === 'Strands Bot' ? 1 : 0;

    let lowestScore = 999;
    const todayByScore = latestScores.reduce((acc, scoreVal) => {
      if (scoreVal.username === 'Strands Bot') {
        return acc;
      }
      if (lowestScore > +scoreVal.score) {
        lowestScore = +scoreVal.score;
      }
      if (!acc[+scoreVal.score]?.length) {
        acc[+scoreVal.score] = [USER_TO_NAME_MAP[scoreVal.username] || scoreVal.username];
      } else {
        acc[+scoreVal.score].push(USER_TO_NAME_MAP[scoreVal.username] || scoreVal.username);
      }
      return acc;
    }, {});

    const messageToSend = `\`\`\`
${summaryTable.toString()}\`\`\`
***Overall Leader: ${USER_TO_NAME_MAP[overallSummary?.[overallLeaderIndex]?.username] || overallSummary?.[overallLeaderIndex]?.username}***
**7 Day Leader: ${USER_TO_NAME_MAP[day7Summary?.[day7LeaderIndex]?.username] || day7Summary?.[day7LeaderIndex]?.username}**
**Today's Winners: ${todayByScore[lowestScore]?.join(', ')}**
    ${FOOTER_MESSAGE ? `*${FOOTER_MESSAGE}*`: ''}`;
    imageToSend = await imageToSend;
    if (interaction) {
      await interaction.deferReply({ephemeral: true});
      await interaction.followUp({content: 'Processing...', ephemeral: true});
      if (imageToSend) {
        await interaction.followUp({
          content: messageToSend,
          files: [{
            attachment: imageToSend,
            name: 'SPOILER_FILE.gif',
          }],
        });
      } else {
        await interaction.followUp(messageToSend);
      }
    } else {
      if (imageToSend) {
        await discordStrandsChannel.send({
          content: messageToSend,
          files: [{
            attachment: imageToSend,
            name: 'SPOILER_FILE.gif',
          }],
        });
      } else {
        await discordStrandsChannel.send(messageToSend);
      }
    }
    this.strandsGame.summaryPosted(latestGameNumber);
  }
}

module.exports = StrandsSummaryCommand;
