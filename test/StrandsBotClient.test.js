const {StrandsBotClient} = require('../src/StrandsBotClient');
const {StrandsScore} = require('../src/data/StrandsScore');
const {StrandsSummaryCommand, StrandsWhoLeftCommand} = require('../src/commands');
const fetch = require('node-fetch-native');

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.mock('node-fetch-native', () => {
  return jest.fn().mockResolvedValue({json: () => ({spangram: 'test'})});
});
jest.mock('../src/data/StrandsScore', () => {
  return ({
    StrandsScore: {
      getInstance: jest.fn().mockReturnValue({
        getScore: jest.fn().mockResolvedValue(),
        createScore: jest.fn().mockResolvedValue(),
        getTotalPlayers: jest.fn().mockResolvedValue([]),
        getPlayersForGame: jest.fn().mockResolvedValue([]),
      }),
    },
  });
});
jest.mock('../src/data/StrandsGame', () => {
  return ({
    StrandsGame: {
      getInstance: jest.fn().mockReturnValue({
        getStrandsGame: jest.fn().mockResolvedValue(),
        createStrandsGame: jest.fn().mockResolvedValue(),
        getLatestGame: jest.fn().mockResolvedValue(125),
        addGameInfo: jest.fn().mockResolvedValue(),
      }),
    },
  });
});

jest.mock('../src/commands/StrandsSummaryCommand', () => {
  return ({
    getInstance: jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue(),
      data: {name: 'strandssummary'},
    }),
  });
});
jest.mock('../src/commands/StrandsWhoLeftCommand', () => {
  return ({
    getInstance: jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue(),
      data: {name: 'strandswholeft'},
    }),
  });
});
const mockedDiscordChannel = {send: jest.fn().mockResolvedValue()};
describe('StrandsBotClient Tests', () => {
  const strandsBot = new StrandsBotClient(mockedDiscordChannel);
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('Empty Message', async () => {
    await strandsBot.messageHandler({content: '', channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });
  test('Empty Message In Strands Channel', async () => {
    await strandsBot.messageHandler({channelId: '1232', content: '', channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });
  test('WhoLeft In Strands Channel', async () => {
    await strandsBot.messageHandler({channelId: '1232', content: '!strandswholeft', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(1);
  });
  test('WhoLeft In strands Channel', async () => {
    await strandsBot.messageHandler({channelId: '1232', content: '/strandswholeft', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(1);
  });

  test('Summary In strands Channel', async () => {
    await strandsBot.messageHandler({channelId: '1232', content: '!strandssummary', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });
  test('Summary In strands Channel', async () => {
    await strandsBot.messageHandler({channelId: '1232', content: '/strandssummary', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('strands Score', async () => {
    await strandsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('strands Score not new', async () => {
    StrandsScore.getInstance().getScore.mockResolvedValueOnce({});
    await strandsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('strands Score invalid solution response', async () => {
    fetch.mockResolvedValueOnce(new Error());
    await strandsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(1);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(0);
  });

  test('strands Score Insult username left', async () => {
    StrandsScore.getInstance().getTotalPlayers.mockResolvedValueOnce(['someUser']);
    await strandsBot.messageHandler({author: {username: 'test'}, channelId: '1232', content: `Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡`, delete: ()=>{}, channel: {id: '234', guildId: '123'}});
    expect(StrandsSummaryCommand.getInstance().execute).toHaveBeenCalledTimes(0);
    expect(StrandsWhoLeftCommand.getInstance().execute).toHaveBeenCalledTimes(1);
  });


  test('Edit Event', async () => {
    await strandsBot.editEvent({channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}}, {channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}});
  });

  test('Edit Event strands', async () => {
    reply = jest.fn().mockResolvedValue();
    await strandsBot.editEvent({author: {username: 'test'}, channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}}, {author: {username: 'test'}, channelId: '1232', channel: {id: '234', guildId: '123'}, content: `Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡`, delete: ()=>{}, lineReply: reply});
    expect(reply).toBeCalledWith('I got you, Edited Strands Score Counted.');
  });

  test('Edit Event strands', async () => {
    StrandsScore.getInstance().getScore.mockResolvedValueOnce(1);
    reply = jest.fn().mockResolvedValue();
    await strandsBot.editEvent({author: {username: 'test'}, channelId: '1232', content: '/monthly', delete: ()=>{}, channel: {id: '234', guildId: '123'}}, {author: {username: 'test'}, channelId: '1232', channel: {id: '234', guildId: '123'}, content: `Strands #125
“By the yard”
💡🔵🔵💡
🔵💡💡🔵
💡🔵🟡`, delete: ()=>{}, lineReply: reply});
    expect(reply).toBeCalledWith('I saw that, Edited Strands Score Ignored.');
  });
});
