/* eslint no-underscore-dangle: ["error", { "allow": ["_id"] }] */
/**
 * A script that generates Blaseball pitcher stats based on gameDataUpdate feeds
 * @WIP
 */
const fs = require('fs');
const ndjson = require('ndjson');

// Location of feed archive
const gameDataUpdatesFile = './data/blaseball-log.json';
const pipeline = fs.createReadStream(gameDataUpdatesFile).pipe(ndjson.parse());

// Maintain objects of all pitcher summaries and events
let pitcherSummaries = {};
let pitcherEvents = {};

// Maintain a copy of the previous game state update
let prevGameStates = null;

// Process game feed logs
pipeline.on('data', (gameDataUpdate) => {
  const currGameStates = gameDataUpdate.schedule;

  // Ignore update if it's identical to previous tick
  if (JSON.stringify(currGameStates) === JSON.stringify(prevGameStates)) {
    return;
  }

  // Iterate through each game in current tick
  currGameStates.forEach((gameState) => {
    // Create a reference to the game's previous tick state
    const prevGameState = prevGameStates
      ? prevGameStates.find((prevState) => prevState._id === gameState._id)
      : null;

    // Ignore games that have not started
    if (!gameState.gameStart) {
      return;
    }

    // Ignores games that were marked as completed in last tick
    if (gameState.gameComplete && prevGameState.gameComplete) {
      return;
    }

    // Ignore game if its state has not changed from last tick
    if (JSON.stringify(gameState) === JSON.stringify(prevGameState)) {
      return;
    }

    // Helper variables for various stat tracking scenarios
    const currPitcher = gameState.topOfInning
      ? gameState.homePitcher
      : gameState.awayPitcher;
    const prevPitcher =
      prevGameState &&
      (prevGameState.topOfInning
        ? prevGameState.homePitcher
        : prevGameState.awayPitcher);
    const awayPitcher = gameState && gameState.awayPitcher;
    const homePitcher = gameState && gameState.homePitcher;

    // Create initial summary objects if pitcher hasn't been previously seen
    if (!Object.prototype.hasOwnProperty.call(pitcherSummaries, currPitcher)) {
      pitcherSummaries[currPitcher] = createPitcherSummaryObject();
      pitcherSummaries[currPitcher].name = gameState.topOfInning
        ? gameState.homePitcherName
        : gameState.awayPitcherName;
    }

    if (
      currPitcher !== awayPitcher &&
      !Object.prototype.hasOwnProperty.call(pitcherSummaries, awayPitcher)
    ) {
      pitcherSummaries[awayPitcher] = createPitcherSummaryObject();
      pitcherSummaries[awayPitcher].name = gameState.awayPitcherName;
    }

    if (
      currPitcher !== homePitcher &&
      !Object.prototype.hasOwnProperty.call(pitcherSummaries, homePitcher)
    ) {
      pitcherSummaries[homePitcher] = createPitcherSummaryObject();
      pitcherSummaries[homePitcher].name = gameState.homePitcherName;
    }

    // Create initial event objects if pitcher hasn't been previously seen
    if (!Object.prototype.hasOwnProperty.call(pitcherEvents, currPitcher)) {
      pitcherEvents[currPitcher] = [];
    }

    if (
      currPitcher !== awayPitcher &&
      !Object.prototype.hasOwnProperty.call(pitcherEvents, awayPitcher)
    ) {
      pitcherEvents[awayPitcher] = [];
    }

    if (
      currPitcher !== homePitcher &&
      !Object.prototype.hasOwnProperty.call(pitcherEvents, homePitcher)
    ) {
      pitcherEvents[homePitcher] = [];
    }

    // Additional helper variables for various stat tracking scenarios
    const currPitcherEvents = pitcherEvents[currPitcher];
    const currPitcherSummary =
      pitcherSummaries[currPitcher].seasons[gameState.season];

    const prevPitcherEvents =
      prevPitcher && prevGameState && pitcherEvents[prevPitcher];
    const prevPitcherSummary =
      prevPitcher &&
      prevGameState &&
      pitcherSummaries[prevPitcher].seasons[prevGameState.season];

    const awayPitcherEvents = pitcherEvents[awayPitcher];
    const awayPitcherSummary =
      pitcherSummaries[awayPitcher].seasons[gameState.season];

    const homePitcherEvents = pitcherEvents[homePitcher];
    const homePitcherSummary = pitcherSummaries[homePitcher];

    // Add player's starting team to season data
    // @TODO: Account for pitcher moving teams during the season
    if (awayPitcherSummary.team === null) {
      awayPitcherSummary.team = gameState.awayTeam;
    }

    if (awayPitcherSummary.teamName === null) {
      awayPitcherSummary.teamName = gameState.awayTeamName;
    }

    if (homePitcherSummary.team === null) {
      homePitcherSummary.team = gameState.homeTeam;
    }

    if (homePitcherSummary.teamName === null) {
      homePitcherSummary.teamName = gameState.homeTeamName;
    }

    // Increment appearances for pitchers
    // @TODO: Account for mid-game pitcher changes
    if (gameState.lastUpdate.match(/Game Over/i) !== null) {
      awayPitcherSummary.appearances += 1;
      homePitcherSummary.appearances += 1;
    }

    // Increment innings pitched
    // @TODO: Account for mid-game pitcher changes
    if (
      (prevGameState &&
        prevGameState.halfInningOuts === 2 &&
        gameState.halfInningOuts === 0) ||
      gameState.lastUpdate.match(/Game Over/i) !== null
    ) {
      prevPitcherSummary.inningsPitched += 1;
      prevPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: gameState,
          result: 'inningPitched'
        })
      );
    }

    // @TODO: Increment number of pitches

    // Increment wins and losses
    // @TODO: Account for mid-game pitcher changes
    if (gameState.lastUpdate.match(/Game Over/i) !== null) {
      if (gameState.homeScore > gameState.awayScore) {
        homePitcherSummary.wins += 1;
        awayPitcherSummary.losses += 1;

        homePitcherEvents.push(
          createPitcherEventObject({
            relativeGameState: gameState,
            result: 'win'
          })
        );
        awayPitcherEvents.push(
          createPitcherEventObject({
            relativeGameState: gameState,
            result: 'loss'
          })
        );
      } else {
        awayPitcherSummary.wins += 1;
        homePitcherSummary.losses += 1;

        awayPitcherEvents.push(
          createPitcherEventObject({
            relativeGameState: gameState,
            result: 'win'
          })
        );
        homePitcherEvents.push(
          createPitcherEventObject({
            relativeGameState: gameState,
            result: 'loss'
          })
        );
      }
    }

    // Increment flyouts
    if (prevGameState && gameState.lastUpdate.match(/flyout/i) !== null) {
      prevPitcherSummary.flyouts += 1;
      prevPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: prevGameState,
          result: 'flyout'
        })
      );
    }

    // Increment groundouts
    if (prevGameState && gameState.lastUpdate.match(/ground out/i) !== null) {
      prevPitcherSummary.groundouts += 1;
      prevPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: prevGameState,
          result: 'groundout'
        })
      );
    }

    // @TODO: Increment saves for replacement pitchers?
    if (
      gameState.lastUpdate.match(/Rogue Umpire incinerated \w+ pitcher/i) !==
      null
    ) {
    }

    // Increment hits allowed (encompasses home runs, doubles, etc)
    if (gameState.lastUpdate.match(/hits a/i) !== null) {
      prevPitcherSummary.hitsAllowed += 1;
      prevPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: prevGameState,
          result: 'hit'
        })
      );
    }

    // Increment bases on balls
    if (gameState.lastUpdate.match(/draws a walk/i) !== null) {
      prevPitcherSummary.basesOnBalls += 1;
      prevPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: prevGameState,
          result: 'baseOnBalls'
        })
      );
    }

    // Increment strikeouts
    // @TODO: Check to see if currPitcher changes if strikeout leads to inning change
    if (gameState.lastUpdate.match(/(strikes out|struck out)/i) !== null) {
      currPitcherSummary.strikeouts += 1;
      currPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: gameState,
          result: 'strikeout'
        })
      );
    }

    // Increment batters faced
    if (gameState.lastUpdate.match(/batting for/i) !== null) {
      currPitcherSummary.battersFaced += 1;
      currPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: gameState,
          result: 'batterFaced'
        })
      );
    }

    // Increment earned runs
    // @TODO: Account for mid-game pitcher changes
    if (
      (prevGameState &&
        prevGameState.halfInningOuts === 2 &&
        gameState.halfInningOuts === 0) ||
      (prevGameState &&
        prevGameState.gameComplete === false &&
        gameState.gameComplete)
    ) {
      prevPitcherSummary.earnedRuns += prevGameState.halfInningScore;
      prevPitcherEvents.push(
        createPitcherEventObject({
          quantity: prevGameState.halfInningScore,
          relativeGameState: prevGameState,
          result: 'earnedRunAllowed'
        })
      );
    }

    // Increment home runs allowed
    if (prevGameState && gameState.lastUpdate.match(/home run/i) !== null) {
      prevPitcherSummary.homeRuns += 1;
      prevPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: prevGameState,
          result: 'homeRun'
        })
      );
    }

    // Increment quality starts
    // @TODO: Account for mid-game pitcher changes
    if (
      prevGameState &&
      prevGameState.gameComplete === false &&
      gameState.lastUpdate.match(/Game over/i) !== null
    ) {
      if (gameState.homeScore <= 3) {
        awayPitcherSummary.qualityStarts += 1;
      }

      if (gameState.homeScore <= 3) {
        homePitcherSummary.qualityStarts += 1;
      }
    }

    // Increment shutouts
    // @TODO: Account for mid-game pitcher changes
    if (
      prevGameState &&
      prevGameState.gameComplete === false &&
      gameState.lastUpdate.match(/Game over/i) !== null
    ) {
      if (gameState.homeScore === 0) {
        awayPitcherSummary.shutouts += 1;
      }

      if (gameState.awayScore === 0) {
        homePitcherSummary.shutouts += 1;
      }
    }
  });

  // Replace previous game states with current game states
  prevGameStates = currGameStates;
});

// Perform final calculations after feed is processed
pipeline.on('end', () => {
  Object.keys(pitcherSummaries).forEach((pitcher) => {
    let careerData = pitcherSummaries[pitcher].careerData;

    Object.keys(pitcherSummaries[pitcher].seasons).forEach((season) => {
      let seasonStats = pitcherSummaries[pitcher].seasons[season];

      // Calculate non-tally based season stats
      seasonStats.winningPercentage = calculateWinningPercentage(seasonStats);
      seasonStats.earnedRunAverage = calculateEarnedRunAverage(seasonStats);
      seasonStats.walksAndHitsPerInningPitched = calculateWalksAndHitsPerInningPitched(
        seasonStats
      );
      seasonStats.walkRate = calculateWalkRate(seasonStats);
      seasonStats.strikeoutRate = calculateStrikeoutRate(seasonStats);

      // Add current season tallies to careerData
      careerData.wins += seasonStats.wins;
      careerData.losses += seasonStats.losses;
      careerData.appearances += seasonStats.appearances;
      careerData.inningsPitched += seasonStats.inningsPitched;
      careerData.shutouts += seasonStats.shutouts;
      careerData.hitsAllowed += seasonStats.hitsAllowed;
      careerData.homeRuns += seasonStats.homeRuns;
      careerData.earnedRuns += seasonStats.earnedRuns;
      careerData.basesOnBalls += seasonStats.basesOnBalls;
      careerData.strikeouts += seasonStats.strikeouts;
      careerData.battersFaced += seasonStats.battersFaced;
      careerData.qualityStarts += seasonStats.qualityStarts;
      careerData.flyouts += seasonStats.flyouts;
      careerData.groundouts += seasonStats.groundouts;
    });

    // Calculate non-tally based career stats
    careerData.winningPercentage = calculateWinningPercentage(careerData);
    careerData.earnedRunAverage = calculateEarnedRunAverage(careerData);
    careerData.walksAndHitsPerInningPitched = calculateWalksAndHitsPerInningPitched(
      careerData
    );
    careerData.walkRate = calculateWalkRate(careerData);
    careerData.strikeoutRate = calculateStrikeoutRate(careerData);
  });

  // Output objects to JSON files
  const fullSummaryWriteStream = fs.createWriteStream(
    `./data/pitcherStats.json`,
    { flags: 'a' }
  );
  fullSummaryWriteStream.write(`${JSON.stringify({ ...pitcherSummaries })}\n`);
  fullSummaryWriteStream.end();

  // console.dir(pitcherSummaries, { depth: null });
  console.log('done');
});

function calculateEarnedRunAverage(stats) {
  return stats.inningsPitched > 0
    ? (9 * stats.earnedRuns) / stats.inningsPitched
    : 0;
}

function calculateStrikeoutRate(stats) {
  return stats.battersFaced > 0 ? stats.strikeouts / stats.battersFaced : 0;
}

function calculateWalksAndHitsPerInningPitched(stats) {
  return stats.inningsPitched > 0
    ? (stats.basesOnBalls + stats.hitsAllowed) / stats.inningsPitched
    : 0;
}

function calculateWalkRate(stats) {
  return stats.battersFaced > 0 ? stats.basesOnBalls / stats.battersFaced : 0;
}

function calculateWinningPercentage(stats) {
  return stats.wins > 0
    ? stats.wins / (stats.wins + stats.losses)
    : stats.losses !== 0
    ? 0
    : 1;
}

function createPitcherEventObject({ quantity, relativeGameState, result }) {
  return {
    gameId: relativeGameState._id,
    inning: relativeGameState.inning,
    outs: relativeGameState.halfInningOuts,
    quantity: quantity,
    result: result,
    seasonId: relativeGameState.season
  };
}

function createPitcherSummaryObject() {
  const pitcherObject = initialPitcherObject();

  return Object.assign(
    {},
    {
      name: null,
      careerData: { ...pitcherObject },
      seasons: {
        '0': { ...pitcherObject },
        '1': { ...pitcherObject },
        '2': { ...pitcherObject }
      }
    }
  );
}

function initialPitcherObject() {
  return {
    appearances: 0,
    battersFaced: 0,
    basesOnBalls: 0,
    earnedRuns: 0,
    earnedRunAverage: 0,
    flyouts: 0,
    groundouts: 0,
    hitsAllowed: 0,
    homeRuns: 0,
    inningsPitched: 0,
    losses: 0,
    numberOfPitches: 0,
    qualityStarts: 0,
    shutouts: 0,
    strikeouts: 0,
    strikeoutRate: 0,
    team: null,
    teamName: null,
    walksAndHitsPerInningPitched: 0,
    walkRate: 0,
    winningPercentage: 0,
    wins: 0
  };
}
