/* eslint no-underscore-dangle: ["error", { "allow": ["_id"] }] */
/**
 * A script that generates Blaseball pitcher stats based on gameDataUpdate feeds
 * - Tailored to blaseball-reference frontend usage
 * - @WIP
 */
const fs = require('fs');
const ndjson = require('ndjson');

// Location of feed archive
const gameDataUpdatesFile = './data/blaseball-log.json';
const pipeline = fs.createReadStream(gameDataUpdatesFile).pipe(ndjson.parse());

// Maintain objects of all pitcher summaries and events
let pitcherSummaries = {};
let pitcherEvents = {};
let playerList = [];

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
    const prevGameState = prevGameStates ? prevGameStates.find((prevState) => prevState._id === gameState._id) : null;

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
    const currPitcher = gameState.topOfInning ? gameState.homePitcher : gameState.awayPitcher;
    const prevPitcher =
      prevGameState && (prevGameState.topOfInning ? prevGameState.homePitcher : prevGameState.awayPitcher);
    const awayPitcher = gameState && gameState.awayPitcher;
    const homePitcher = gameState && gameState.homePitcher;

    // Create initial summary objects if pitcher hasn't been previously seen
    if (!Object.prototype.hasOwnProperty.call(pitcherSummaries, currPitcher)) {
      pitcherSummaries[currPitcher] = createPitcherSummaryObject({
        id: currPitcher,
        name: gameState.topOfInning ? gameState.homePitcherName : gameState.awayPitcherName
      });
    }

    if (currPitcher !== awayPitcher && !Object.prototype.hasOwnProperty.call(pitcherSummaries, awayPitcher)) {
      pitcherSummaries[awayPitcher] = createPitcherSummaryObject({
        id: awayPitcher,
        name: gameState.awayPitcherName
      });
    }

    if (currPitcher !== homePitcher && !Object.prototype.hasOwnProperty.call(pitcherSummaries, homePitcher)) {
      pitcherSummaries[homePitcher] = createPitcherSummaryObject({
        id: homePitcher,
        name: gameState.homePitcherName
      });
    }

    // Create initial event objects if pitcher hasn't been previously seen
    if (!Object.prototype.hasOwnProperty.call(pitcherEvents, currPitcher)) {
      pitcherEvents[currPitcher] = [];
    }

    if (currPitcher !== awayPitcher && !Object.prototype.hasOwnProperty.call(pitcherEvents, awayPitcher)) {
      pitcherEvents[awayPitcher] = [];
    }

    if (currPitcher !== homePitcher && !Object.prototype.hasOwnProperty.call(pitcherEvents, homePitcher)) {
      pitcherEvents[homePitcher] = [];
    }

    // Add player to player list
    if (playerList.find((p) => p.id === currPitcher) === undefined) {
      const name = gameState.topOfInning ? gameState.homePitcherName : gameState.awayPitcherName;
      playerList.push({
        id: currPitcher,
        currentTeamId: gameState.topOfInning ? gameState.homeTeam : gameState.awayTeam,
        currentTeamName: gameState.topOfInning ? gameState.homeTeamName : gameState.awayTeamName,
        debutDay: gameState.day,
        debutGameId: gameState._id,
        debutSeason: gameState.season,
        debutTeamId: gameState.topOfInning ? gameState.homeTeam : gameState.awayTeam,
        debutTeamName: gameState.topOfInning ? gameState.homeTeamName : gameState.awayTeamName,
        isIncinerated: false,
        incineratedGameDay: null,
        incineratedGameId: null,
        incineratedGameSeason: null,
        lastGameDay: gameState.day,
        lastGameId: gameState._id,
        lastGameSeason: gameState.season,
        name: name,
        position: 'rotation',
        slug: name.toLowerCase().replace(/\s/g, '-')
      });
    } else {
      let player = playerList.find((p) => p.id === currPitcher);
      player.currentTeamId = gameState.topOfInning ? gameState.homeTeam : gameState.awayTeam;
      player.currentTeamName = gameState.topOfInning ? gameState.homeTeamName : gameState.awayTeamName;
      player.lastGameDay = gameState.day;
      player.lastGameId = gameState._id;
      player.lastGameSeason = gameState.season;
    }

    if (currPitcher !== awayPitcher) {
      if (playerList.find((p) => p.id === awayPitcher) === undefined) {
        playerList.push({
          id: awayPitcher,
          currentTeamId: gameState.awayTeam,
          currentTeamName: gameState.awayTeamName,
          debutDay: gameState.day,
          debutGameId: gameState._id,
          debutSeason: gameState.season,
          debutTeamId: gameState.awayTeam,
          debutTeamName: gameState.awayTeamName,
          incineratedGameDay: null,
          incineratedGameId: null,
          incineratedGameSeason: null,
          isIncinerated: false,
          lastGameDay: gameState.day,
          lastGameId: gameState._id,
          lastGameSeason: gameState.season,
          name: gameState.awayPitcherName,
          position: 'rotation',
          slug: gameState.awayPitcherName.toLowerCase().replace(/\s/g, '-')
        });
      } else {
        let player = playerList.find((p) => p.id === awayPitcher);
        player.currentTeamId = gameState.awayTeam;
        player.currentTeamName = gameState.awayTeamName;
        player.lastGameDay = gameState.day;
        player.lastGameId = gameState._id;
        player.lastGameSeason = gameState.season;
      }
    }

    if (currPitcher !== homePitcher) {
      if (playerList.find((p) => p.id === homePitcher) === undefined) {
        playerList.push({
          id: homePitcher,
          currentTeamId: gameState.homeTeam,
          currentTeamName: gameState.homeTeamName,
          incineratedGameDay: null,
          incineratedGameId: null,
          incineratedGameSeason: null,
          debutDay: gameState.day,
          debutGameId: gameState._id,
          debutSeason: gameState.season,
          debutTeamId: gameState.homeTeam,
          debutTeamName: gameState.homeTeamName,
          incineratedGameDay: null,
          incineratedGameId: null,
          incineratedGameSeason: null,
          isIncinerated: false,
          lastGameDay: gameState.day,
          lastGameId: gameState._id,
          lastGameSeason: gameState.season,
          name: gameState.homePitcherName,
          position: 'rotation',
          slug: gameState.homePitcherName.toLowerCase().replace(/\s/g, '-')
        });
      } else {
        let player = playerList.find((p) => p.id === homePitcher);
        player.currentTeamId = gameState.homeTeam;
        player.currentTeamName = gameState.homeTeamName;
        player.lastGameDay = gameState.day;
        player.lastGameId = gameState._id;
        player.lastGameSeason = gameState.season;
      }
    }

    // Initialize pitcher stat objects for newly recorded seasons and postseasons
    // - Postseasons
    if (gameState.isPostseason && !pitcherSummaries[currPitcher].postSeasons.hasOwnProperty(gameState.season)) {
      pitcherSummaries[currPitcher].postSeasons[gameState.season] = initialPitcherStatsObject();
    }

    if (
      currPitcher !== awayPitcher &&
      gameState.isPostseason &&
      !pitcherSummaries[awayPitcher].postSeasons.hasOwnProperty(gameState.season)
    ) {
      pitcherSummaries[awayPitcher].postSeasons[gameState.season] = initialPitcherStatsObject();
    }

    if (
      currPitcher !== homePitcher &&
      gameState.isPostseason &&
      !pitcherSummaries[homePitcher].postSeasons.hasOwnProperty(gameState.season)
    ) {
      pitcherSummaries[homePitcher].postSeasons[gameState.season] = initialPitcherStatsObject();
    }

    // - Seasons
    if (!gameState.isPostseason && !pitcherSummaries[currPitcher].seasons.hasOwnProperty(gameState.season)) {
      pitcherSummaries[currPitcher].seasons[gameState.season] = initialPitcherStatsObject();
    }

    if (
      currPitcher !== awayPitcher &&
      !gameState.isPostseason &&
      !pitcherSummaries[awayPitcher].seasons.hasOwnProperty(gameState.season)
    ) {
      pitcherSummaries[awayPitcher].seasons[gameState.season] = initialPitcherStatsObject();
    }

    if (
      currPitcher !== homePitcher &&
      !gameState.isPostseason &&
      !pitcherSummaries[homePitcher].seasons.hasOwnProperty(gameState.season)
    ) {
      pitcherSummaries[homePitcher].seasons[gameState.season] = initialPitcherStatsObject();
    }

    // Additional helper variables for various stat tracking scenarios
    const currPitcherEvents = pitcherEvents[currPitcher];
    const currPitcherSummary = gameState.isPostseason
      ? pitcherSummaries[currPitcher].postSeasons[gameState.season]
      : pitcherSummaries[currPitcher].seasons[gameState.season];

    const awayPitcherEvents = pitcherEvents[awayPitcher];
    const awayPitcherSummary = gameState.isPostseason
      ? pitcherSummaries[awayPitcher].postSeasons[gameState.season]
      : pitcherSummaries[awayPitcher].seasons[gameState.season];

    const homePitcherEvents = pitcherEvents[homePitcher];
    const homePitcherSummary = gameState.isPostseason
      ? pitcherSummaries[homePitcher].postSeasons[gameState.season]
      : pitcherSummaries[homePitcher].seasons[gameState.season];

    const prevPitcherEvents = prevPitcher ? pitcherEvents[prevPitcher] : null;
    const prevPitcherSummary = prevPitcher
      ? prevGameState.isPostseason
        ? pitcherSummaries[prevPitcher].postSeasons[prevGameState.season]
        : pitcherSummaries[prevPitcher].seasons[prevGameState.season]
      : null;

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
      (prevGameState && prevGameState.halfInningOuts === 2 && gameState.halfInningOuts === 0) ||
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

    // Update incinerated pitcher player files following incineration
    // @TODO: Increment saves for replacement pitchers?
    const incineratedPitcherMatch = gameState.lastUpdate.match(/Rogue Umpire incinerated [\w\s]+ pitcher ([\w\s]+)!/i);
    if (prevGameState && incineratedPitcherMatch !== null) {
      let incineratedPitcherId = null;

      // Locate incinerated pitcher ID and name
      if (incineratedPitcherMatch[1] === prevGameState.homePitcherName) {
        incineratedPitcherId = prevGameState.homePitcher;
      } else {
        incineratedPitcherId = prevGameState.awayPitcher;
      }

      // Update incinerated player's player file
      if (incineratedPitcherId) {
        let incineratedPlayer = playerList.find((p) => p.id === incineratedPitcherId);

        if (incineratedPlayer) {
          incineratedPlayer.incineratedGameDay = prevGameState.day;
          incineratedPlayer.incineratedGameId = prevGameState._id;
          incineratedPlayer.incineratedGameSeason = prevGameState.season;
          incineratedPlayer.isIncinerated = true;
        }
      }
    }

    // Increment hits allowed (encompasses home runs, doubles, etc)
    if (prevPitcherSummary && gameState.lastUpdate.match(/hits a/i) !== null) {
      prevPitcherSummary.hitsAllowed += 1;
      prevPitcherEvents.push(
        createPitcherEventObject({
          relativeGameState: prevGameState,
          result: 'hit'
        })
      );
    }

    // Increment bases on balls
    if (prevPitcherSummary && gameState.lastUpdate.match(/draws a walk/i) !== null) {
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
      (prevGameState && prevGameState.halfInningOuts === 2 && gameState.halfInningOuts === 0) ||
      (prevGameState && prevGameState.gameComplete === false && gameState.gameComplete)
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
    if (prevGameState && prevGameState.gameComplete === false && gameState.lastUpdate.match(/Game over/i) !== null) {
      if (gameState.homeScore <= 3) {
        awayPitcherSummary.qualityStarts += 1;
      }

      if (gameState.homeScore <= 3) {
        homePitcherSummary.qualityStarts += 1;
      }
    }

    // Increment shutouts
    // @TODO: Account for mid-game pitcher changes
    if (prevGameState && prevGameState.gameComplete === false && gameState.lastUpdate.match(/Game over/i) !== null) {
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
pipeline.on('end', async () => {
  Object.keys(pitcherSummaries).forEach((pitcher) => {
    let careerData = pitcherSummaries[pitcher].careerData;
    let seasonsData = pitcherSummaries[pitcher].seasons;
    let postSeasonsData = pitcherSummaries[pitcher].postSeasons;

    Object.keys(seasonsData).forEach((season) => {
      let seasonStats = pitcherSummaries[pitcher].seasons[season];

      // Calculate non-tally based season stats
      seasonStats.basesOnBallsPerNine = calculateBasesOnBallsPerNine(seasonStats);
      seasonStats.earnedRunAverage = calculateEarnedRunAverage(seasonStats);
      seasonStats.hitsAllowedPerNine = calculateHitsAllowedPerNine(seasonStats);
      seasonStats.homeRunsPerNine = calculateHomeRunsPerNine(seasonStats);
      seasonStats.strikeoutsPerNine = calculateStrikeoutsPerNine(seasonStats);
      seasonStats.strikeoutRate = calculateStrikeoutRate(seasonStats);
      seasonStats.strikeoutToWalkRatio = calculateStrikeoutToWalkRatio(seasonStats);
      seasonStats.walksAndHitsPerInningPitched = calculateWalksAndHitsPerInningPitched(seasonStats);
      seasonStats.walkRate = calculateWalkRate(seasonStats);
      seasonStats.winningPercentage = calculateWinningPercentage(seasonStats);

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

    Object.keys(postSeasonsData).forEach((postSeason) => {
      let postSeasonStats = pitcherSummaries[pitcher].postSeasons[postSeason];

      // Calculate non-tally based postseason stats
      postSeasonStats.basesOnBallsPerNine = calculateBasesOnBallsPerNine(postSeasonStats);
      postSeasonStats.earnedRunAverage = calculateEarnedRunAverage(postSeasonStats);
      postSeasonStats.hitsAllowedPerNine = calculateHitsAllowedPerNine(postSeasonStats);
      postSeasonStats.homeRunsPerNine = calculateHomeRunsPerNine(postSeasonStats);
      postSeasonStats.strikeoutsPerNine = calculateStrikeoutsPerNine(postSeasonStats);
      postSeasonStats.strikeoutRate = calculateStrikeoutRate(postSeasonStats);
      postSeasonStats.strikeoutToWalkRatio = calculateStrikeoutToWalkRatio(postSeasonStats);
      postSeasonStats.walksAndHitsPerInningPitched = calculateWalksAndHitsPerInningPitched(postSeasonStats);
      postSeasonStats.walkRate = calculateWalkRate(postSeasonStats);
      postSeasonStats.winningPercentage = calculateWinningPercentage(postSeasonStats);
    });

    // Calculate non-tally based career season stats
    careerData.basesOnBallsPerNine = calculateBasesOnBallsPerNine(careerData);
    careerData.earnedRunAverage = calculateEarnedRunAverage(careerData);
    careerData.hitsAllowedPerNine = calculateHitsAllowedPerNine(careerData);
    careerData.homeRunsPerNine = calculateHomeRunsPerNine(careerData);
    careerData.strikeoutsPerNine = calculateStrikeoutsPerNine(careerData);
    careerData.strikeoutRate = calculateStrikeoutRate(careerData);
    careerData.strikeoutToWalkRatio = calculateStrikeoutToWalkRatio(careerData);
    careerData.walksAndHitsPerInningPitched = calculateWalksAndHitsPerInningPitched(careerData);
    careerData.walkRate = calculateWalkRate(careerData);
    careerData.winningPercentage = calculateWinningPercentage(careerData);
  });

  // Output objects to JSON files
  await fs.promises.mkdir('./data/pitchers', { recursive: true }, (err) => {
    if (err) throw err;
  });
  const pitcherSummariesWriteStream = fs.createWriteStream('./data/pitchers/pitchers.json', {
    flags: 'a'
  });
  pitcherSummariesWriteStream.write(`${JSON.stringify({ ...pitcherSummaries })}\n`);
  pitcherSummariesWriteStream.end();

  Object.keys(pitcherSummaries).forEach(async (pitcher) => {
    // Output individual pitchers summaries
    const encodedPitcherName = encodeURI(pitcherSummaries[pitcher].name.toLowerCase().replace(/\s/g, '-'));
    await fs.promises.mkdir(`./data/pitchers/${encodedPitcherName}`, { recursive: true }, (err) => {
      if (err) throw err;
    });
    const pitcherSummaryWriteStream = fs.createWriteStream(`./data/pitching/${encodedPitcherName}/summary.json`, {
      flags: 'a'
    });
    pitcherSummaryWriteStream.write(`${JSON.stringify({ ...pitcherSummaries[pitcher] })}\n`);
    pitcherSummaryWriteStream.end();
  });

  // Append pitcher to list of all players
  await fs.promises.mkdir(`./data/players`, { recursive: true }, (err) => {
    if (err) throw err;
  });
  const playerListWriteStream = fs.createWriteStream('./data/players/players.json', { flags: 'a' });
  playerListWriteStream.write(`${JSON.stringify(playerList)}\n`);
  playerListWriteStream.end();

  // console.dir(pitcherSummaries, { depth: null });
  console.log('done');
});

function calculateBasesOnBallsPerNine(stats) {
  return stats.inningsPitched > 0 ? (stats.basesOnBalls / stats.inningsPitched) * 9 : 0;
}

function calculateEarnedRunAverage(stats) {
  return stats.inningsPitched > 0 ? (9 * stats.earnedRuns) / stats.inningsPitched : 0;
}

function calculateHitsAllowedPerNine(stats) {
  return stats.inningsPitched > 0 ? (stats.hitsAllowed / stats.inningsPitched) * 9 : 0;
}

function calculateHomeRunsPerNine(stats) {
  return stats.inningsPitched > 0 ? (stats.homeRuns / stats.inningsPitched) * 9 : 0;
}

function calculateStrikeoutToWalkRatio(stats) {
  return stats.basesOnBalls > 0 ? stats.strikeouts / stats.basesOnBalls : 0;
}

function calculateStrikeoutsPerNine(stats) {
  return stats.inningsPitched > 0 ? (stats.strikeouts / stats.inningsPitched) * 9 : 0;
}

function calculateStrikeoutRate(stats) {
  return stats.battersFaced > 0 ? stats.strikeouts / stats.battersFaced : 0;
}

function calculateWalksAndHitsPerInningPitched(stats) {
  return stats.inningsPitched > 0 ? (stats.basesOnBalls + stats.hitsAllowed) / stats.inningsPitched : 0;
}

function calculateWalkRate(stats) {
  return stats.battersFaced > 0 ? stats.basesOnBalls / stats.battersFaced : 0;
}

function calculateWinningPercentage(stats) {
  return stats.wins > 0 ? stats.wins / (stats.wins + stats.losses) : stats.losses !== 0 ? 0 : 1;
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

function createPitcherSummaryObject(initialValues) {
  const defaults = {
    id: null,
    name: null,
    careerData: {},
    seasons: {},
    postSeasons: {}
  };

  // Perform a shallow copy of initialValues over defaults
  return Object.assign({}, defaults, initialValues);
}

function createPlayerObject(relativeGameState = {}, initialvalues = {}) {
  const defaults = {
    id: currPitcher,
    currentTeamId: gameState.topOfInning ? gameState.homeTeam : gameState.awayTeam,
    currentTeamName: gameState.topOfInning ? gameState.homeTeamName : gameState.awayTeamName,
    debutDay: gameState.day,
    debutGameId: gameState._id,
    debutSeason: gameState.season,
    debutTeamId: gameState.topOfInning ? gameState.homeTeam : gameState.awayTeam,
    debutTeamName: gameState.topOfInning ? gameState.homeTeamName : gameState.awayTeamName,
    isIncinerated: false,
    incineratedGameDay: null,
    incineratedGameId: null,
    incineratedGameSeason: null,
    lastGameDay: gameState.day,
    lastGameId: gameState._id,
    lastGameSeason: gameState.season,
    name: name,
    position: 'rotation',
    slug: name.toLowerCase().replace(/\s/g, '-')
  };
}

function initialPitcherStatsObject(initialValues = {}) {
  const defaults = {
    appearances: 0,
    battersFaced: 0,
    basesOnBalls: 0,
    basesOnBallsPerNine: 0,
    earnedRuns: 0,
    earnedRunAverage: 0,
    flyouts: 0,
    groundouts: 0,
    hitsAllowed: 0,
    hitsAllowedPerNine: 0,
    homeRuns: 0,
    homeRunsPerNine: 0,
    inningsPitched: 0,
    losses: 0,
    numberOfPitches: 0,
    qualityStarts: 0,
    shutouts: 0,
    strikeouts: 0,
    strikeoutToWalkRatio: 0,
    strikeoutsPerNine: 0,
    strikeoutRate: 0,
    team: null,
    teamName: null,
    walksAndHitsPerInningPitched: 0,
    walkRate: 0,
    winningPercentage: 0,
    wins: 0
  };

  // Perform a shallow copy of initialValues over defaults
  return Object.assign({}, defaults, initialValues);
}
