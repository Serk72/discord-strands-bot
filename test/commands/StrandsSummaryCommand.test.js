const StrandsSummaryCommand = require('../../src/commands/StrandsSummaryCommand');
const {StrandsScore} = require('../../src/data/StrandsScore');
const {StrandsGame} = require('../../src/data/StrandsGame');
const fetch = require('node-fetch-native');
jest.spyOn(console, 'error').mockImplementation(() => {});

jest.mock('node-fetch-native', () => {
  return jest.fn().mockResolvedValue({json: () => ({data: [{url: 'someUrl'}]})});
});
jest.mock('../../src/data/StrandsGame', () => {
  return ({
    StrandsGame: {
      getInstance: jest.fn().mockReturnValue({
        getStrandsGame: jest.fn().mockResolvedValue(),
        createStrandsGame: jest.fn().mockResolvedValue(),
        getLatestGame: jest.fn().mockResolvedValue(1),
        summaryPosted: jest.fn().mockResolvedValue(),
      }),
    },
  });
});
jest.mock('../../src/data/StrandsScore', () => {
  return ({
    StrandsScore: {
      getInstance: jest.fn().mockReturnValue({
        getPlayerSummaries: jest.fn().mockResolvedValue([]),
        getLast7DaysSummaries: jest.fn().mockResolvedValue([]),
        getLastMonthSummaries: jest.fn().mockResolvedValue([]),
        getPlayerInfoForGame: jest.fn().mockResolvedValue([{username: 'test', completedcategory1: true}]),
        getGameScores: jest.fn().mockResolvedValue([]),
      }),
    },
  });
});
const mockedDiscordChannel = {send: jest.fn().mockResolvedValue()};
describe('SummaryCommand Tests', () => {
  const summaryCommand = StrandsSummaryCommand.getInstance();
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('summary with results Interaction', async () => {
    StrandsScore.getInstance().getPlayerSummaries.mockResolvedValueOnce( [{
      username: 'test',
      games: '1',
      average: '7',
      totalscore: '7',
    }]);
    const mockedInteraction = {followUp: jest.fn().mockResolvedValue(), deferReply: jest.fn().mockResolvedValue()};
    await summaryCommand.execute(mockedInteraction);
    expect(mockedInteraction.followUp).toBeCalledWith(`\`\`\`
.----------------------.
|   Strands Summary    |
|----------------------|
| User | GP | AS | 7DA |
|------|----|----|-----|
| test |  1 | 7  |     |
'----------------------'\`\`\`
***Overall Leader: test***
**7 Day Leader: undefined**
**Today's Winners: undefined**
    *Brought to you by ...*`);
  });

  test('summary with results Channel', async () => {
    StrandsScore.getInstance().getPlayerSummaries.mockResolvedValueOnce( [{
      username: 'test',
      games: '1',
      average: '7',
      totalscore: '7',
    }]);
    await summaryCommand.execute(null, mockedDiscordChannel);
    expect(mockedDiscordChannel.send).toBeCalledWith(`\`\`\`
.----------------------.
|   Strands Summary    |
|----------------------|
| User | GP | AS | 7DA |
|------|----|----|-----|
| test |  1 | 7  |     |
'----------------------'\`\`\`
***Overall Leader: test***
**7 Day Leader: undefined**
**Today's Winners: undefined**
    *Brought to you by ...*`);
  });

  test('summary with results Channel with giphy link', async () => {
    StrandsScore.getInstance().getPlayerSummaries.mockResolvedValueOnce( [{
      username: 'test',
      games: '1',
      average: '7',
      totalscore: '7',
    }]);
    StrandsGame.getInstance().getStrandsGame.mockResolvedValueOnce( {
      spangram: 'tests',
    });
    await summaryCommand.execute(null, mockedDiscordChannel);
    expect(mockedDiscordChannel.send).toBeCalledWith({content: `\`\`\`
.----------------------.
|   Strands Summary    |
|----------------------|
| User | GP | AS | 7DA |
|------|----|----|-----|
| test |  1 | 7  |     |
'----------------------'\`\`\`
***Overall Leader: test***
**7 Day Leader: undefined**
**Today's Winners: undefined**
    *Brought to you by ...*`, files: [{attachment: 'someUrl', name: 'SPOILER_FILE.gif'}]});
  });
  test('summary with results Channel with giphy link error', async () => {
    fetch.mockResolvedValueOnce(new Error());
    StrandsScore.getInstance().getPlayerSummaries.mockResolvedValueOnce( [{
      username: 'test',
      games: '1',
      average: '7',
      totalscore: '7',
    }]);
    StrandsGame.getInstance().getStrandsGame.mockResolvedValueOnce( {
      spangram: 'tests',
    });
    await summaryCommand.execute(null, mockedDiscordChannel);
    expect(mockedDiscordChannel.send).toBeCalledWith(`\`\`\`
.----------------------.
|   Strands Summary    |
|----------------------|
| User | GP | AS | 7DA |
|------|----|----|-----|
| test |  1 | 7  |     |
'----------------------'\`\`\`
***Overall Leader: test***
**7 Day Leader: undefined**
**Today's Winners: undefined**
    *Brought to you by ...*`);
  });

  test('test invalid command', async () => {
    let error = false;
    try {
      await summaryCommand.execute(null, null);
    } catch (err) {
      error = true;
    }
    expect(error).toBe(true);
  });
});
