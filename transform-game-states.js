/* eslint no-underscore-dangle: ["error", { "allow": ["_id"] }] */
/**
 * Blaseball gameDataUpdate state transformer for database insertion
 *
 * WIP
 */

const fs = require('fs');
const ndjson = require('ndjson');

const gameDataUpdatesFile = './data/single-game-updates-deduped.json';
const pipeline = fs.createReadStream(gameDataUpdatesFile).pipe(ndjson.parse());

const teams = require('./data/teams.json');

// Maintain a copy of the previous game state update
let prevGameStates = null;

pipeline.on('data', (gameDataUpdate) => {
  const currGameStates = gameDataUpdate.schedule;

  /**
   * Ignore state update if it's a duplicate of the previous state
   *
   * In the future we could potentially use the client metadata to infer pitches in cases
   * where the count is 3-2 and the batter hits a foul ball
   * */
  if (JSON.stringify(currGameStates) === JSON.stringify(prevGameStates)) {
    return;
  }

  const currClientMeta = gameDataUpdate.clientMeta;

  currGameStates.forEach((gameState) => {
    const homeTeam = teams.find((team) => team._id === gameState.homeTeam);
    const eventFileName = `${(gameState.season + 1).toString().padStart(4, '0')}${homeTeam.shorthand}.json`;
    const gameWriteStream = fs.createWriteStream(`./data/games/${eventFileName}`, { flags: 'a' });

    const prevGameState = prevGameStates
      ? prevGameStates.find((prevState) => prevState._id === gameState._id)
      : null;

    const event = {};

    if (currClientMeta && currClientMeta.timestamp) {
      event.perceived_at = currClientMeta.timestamp;
    }

    event.playRecord = ''; // @TODO
    event.pitches = []; // @TODO

    event.game_id = gameState._id;

    event.event_type = ''; // @TODO
    event.event_index = 0; // @TODO
    event.inning = gameState.inning;
    event.outs_before_play = gameState.halfInningOuts;
    event.batter_id = gameState.topOfInning
      ? gameState.awayBatter
      : gameState.homeBatter;
    event.batter_team_id = gameState.topOfInning
      ? gameState.awayTeam
      : gameState.homeTeam;
    event.pitcher_id = gameState.topOfInning
      ? gameState.homePitcher
      : gameState.awayPitcher;
    event.pitcher_team_id = gameState.topOfInning
      ? gameState.homeTeam
      : gameState.awayTeam;
    event.home_score = gameState.homeScore;
    event.away_score = gameState.awayScore;
    event.home_strike_count = gameState.homeStrikes;
    event.away_strike_count = gameState.awayStrikes;
    event.batter_count = gameState.topOfInning
      ? gameState.awayTeamBatterCount
      : gameState.homeTeamBatterCount;
    event.pitches = ''; // @TODO
    event.total_strikes = gameState.atBatStrikes;
    event.total_balls = gameState.atBatBalls;
    event.total_total_fouls = ''; // @TODO
    event.is_leadoff = (gameState.topOfInning
      ? gameState.awayTeamBatterCount === 0
      : gameState.homeTeamBatterCount === 0)
    || (prevGameState
      && prevGameState.halfInningOuts === 2
      && gameState.halfInningOuts === 0); // @TODO: bugfix
    event.is_pinch_hit = prevGameState && prevGameState.lastUpdate.match(/Rogue Umpire incinerated \w+ hitter/i) !== null; // @TODO
    event.lineup_position = ''; // @TODO
    event.is_last_event_for_at_bat = ''; // @TODO
    event.bases_hit = '';
    event.runs_batted_in = '';
    event.is_sacrifice_hit = '';
    event.is_sacrifice_fly = '';
    event.outs_on_play = '';
    event.is_double_play = '';
    event.is_triple_play = '';
    event.is_wild_pitch = '';
    event.batted_ball_type = '';
    event.is_bunt = '';
    event.errors_on_play = '';
    event.batter_base_after_play = '';
    event.base_runners = '';
    event.is_last_game_event = '';
    event.additional_context = '';

    gameWriteStream.write(
      `${JSON.stringify({ ...event })}\n`,
    );

    gameWriteStream.end();
  });

  prevGameStates = currGameStates;
});

pipeline.on('end', () => {
  console.log('done');
});
