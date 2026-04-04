import { GameState, WardDefinition, ScoredWardSpot, WardCondition } from '../types';

// Map bounds: x: -120 to 14870, y: -120 to 14980
// Normalization: nx = (game_x + 120) / 14990, ny = 1 - ((game_y + 120) / 15100)
//
// Reference landmarks (game coords → normalized minimap):
//   Dragon pit:        (9866, 4414)  → (0.666, 0.708)
//   Baron pit:         (5007, 10120) → (0.342, 0.322)
//   Blue Blue Buff:    (3821, 7901)  → (0.263, 0.469)
//   Blue Red Buff:     (7862, 4112)  → (0.532, 0.728)
//   Red Blue Buff:     (10931, 6990) → (0.737, 0.530)
//   Red Red Buff:      (7100, 10800) → (0.482, 0.277)
//   Blue Raptors:      (6974, 5428)  → (0.473, 0.641)
//   Red Raptors:       (7852, 9506)  → (0.532, 0.363)
//   Blue Gromp:        (2284, 8448)  → (0.160, 0.433)
//   Red Gromp:         (12588, 6466) → (0.848, 0.565)
//   Blue Wolves:       (3780, 6443)  → (0.260, 0.573)
//   Red Wolves:        (11008, 8410) → (0.742, 0.436)
//   Blue Krugs:        (8370, 2726)  → (0.567, 0.820)
//   Red Krugs:         (6480, 12170) → (0.440, 0.187)
//   River center:      (7500, 7500)  → (0.508, 0.503)
//   Pixel brush bot:   (7550, 6200)  → (0.512, 0.590)
//   Pixel brush top:   (7370, 8700)  → (0.500, 0.424)
//   Bot river brush:   (10200, 3600) → (0.688, 0.762)
//   Top river brush:   (4700, 11300) → (0.322, 0.256)
//   Blue bot tri:      (7100, 1600)  → (0.482, 0.894)
//   Red top tri:       (7800, 13300) → (0.528, 0.113)

// Signal evaluators — return true if condition is active
const signalEvaluators: Record<string, (state: GameState) => boolean> = {
  earlyGame: (s) => s.phase === 'early',
  midGame: (s) => s.phase === 'mid',
  lateGame: (s) => s.phase === 'late',

  dragonSpawningSoon: (s) => {
    if (!s.dragonAlive && s.lastDragonKillTime > 0) {
      const respawnTime = s.lastDragonKillTime + 5 * 60;
      return respawnTime - s.gameTime < 60 && respawnTime - s.gameTime > 0;
    }
    // Dragon is alive or about to first spawn
    if (s.gameTime > 4 * 60 && s.gameTime < 5 * 60) return true;
    return s.dragonAlive;
  },

  baronSpawningSoon: (s) => {
    if (!s.baronAlive && s.lastBaronKillTime > 0) {
      const respawnTime = s.lastBaronKillTime + 6 * 60;
      return respawnTime - s.gameTime < 60 && respawnTime - s.gameTime > 0;
    }
    if (s.gameTime > 19 * 60 && s.gameTime < 20 * 60) return true;
    return s.baronAlive;
  },

  heraldAlive: (s) => s.heraldAlive,
  grubsAlive: (s) => s.grubsAlive,

  teamAhead: (s) => s.goldAdvantage > 2000,
  teamBehind: (s) => s.goldAdvantage < -2000,
  teamEven: (s) => s.goldAdvantage >= -2000 && s.goldAdvantage <= 2000,

  // A teammate died = enemy got a kill
  recentTeammateDeath: (s) => s.recentEvents.some(
    e => e.eventName === 'ChampionKill' && s.gameTime - e.eventTime < 30 && e.isTeamKill === false
  ),
  // We got a kill
  recentEnemyKill: (s) => s.recentEvents.some(
    e => e.eventName === 'ChampionKill' && s.gameTime - e.eventTime < 30 && e.isTeamKill === true
  ),

  activePlayerAlive: (s) => !s.activePlayerDead,

  blueSide: (s) => s.side === 'blue',
  redSide: (s) => s.side === 'red',

  roleSupport: (s) => s.activePlayerRole === 'support',
  roleJungle: (s) => s.activePlayerRole === 'jungle',
  roleMid: (s) => s.activePlayerRole === 'mid',
  roleTop: (s) => s.activePlayerRole === 'top',
  roleADC: (s) => s.activePlayerRole === 'bottom',

  // Always-true signal for constant bonuses (e.g. Challenger popularity)
  always: () => true,

  // GEP boost signals — temporary boosts from real-time events
  urgentOffensive: (s) => s.activeBoosts.some(b => b.signal === 'urgentOffensive'),
  urgentDefensive: (s) => s.activeBoosts.some(b => b.signal === 'urgentDefensive'),
  objectiveJustTaken: (s) => s.activeBoosts.some(b => b.signal === 'objectiveJustTaken'),
  turretDown: (s) => s.activeBoosts.some(b => b.signal === 'turretDown'),
};

function evaluateScore(conditions: WardCondition[], state: GameState): number {
  let score = 0;
  for (const cond of conditions) {
    const evaluator = signalEvaluators[cond.signal];
    if (evaluator && evaluator(state)) {
      score += cond.weight;
    }
  }
  return score;
}

// Ward definitions — 45 positions mapped by user clicking on minimap in-game
const wardDefinitions: WardDefinition[] = [
  // ===== BOT LANE AREA =====
  // #1 Bot Tri-Brush (blue side)
  { x: 0.536, y: 0.910, label: 'Bot Tri-Brush', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'earlyGame', weight: 25 }, { signal: 'teamBehind', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleSupport', weight: 25 }, { signal: 'roleADC', weight: 20 },
    
      { signal: 'always', weight: 10 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #2 Bot River Bush
  { x: 0.622, y: 0.833, label: 'Bot River Bush', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 25 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleSupport', weight: 25 }, { signal: 'roleADC', weight: 20 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
    ]},
  // #3 Blue Krugs/Bot Lane Entrance
  { x: 0.490, y: 0.777, label: 'Blue Krugs Area', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'earlyGame', weight: 10 }, { signal: 'teamBehind', weight: 20 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleSupport', weight: 15 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #4 Bot Lane Bush (river side)
  { x: 0.696, y: 0.777, label: 'Bot Lane Bush', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 15 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleSupport', weight: 20 }, { signal: 'roleADC', weight: 15 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
    ]},
  // #17 Blue Red Buff Area
  { x: 0.364, y: 0.768, label: 'Blue Red Buff', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'earlyGame', weight: 10 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 20 },
    
      { signal: 'always', weight: 10 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},

  // ===== DRAGON AREA =====
  // #5 Dragon Pit
  { x: 0.585, y: 0.668, label: 'Dragon Pit', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'dragonSpawningSoon', weight: 40 }, { signal: 'midGame', weight: 15 }, { signal: 'lateGame', weight: 20 },
      { signal: 'activePlayerAlive', weight: 5 }, { signal: 'roleSupport', weight: 20 }, { signal: 'roleJungle', weight: 20 },
      { signal: 'objectiveJustTaken', weight: 15 },
    ]},
  // #6 Dragon Entrance (blue side)
  { x: 0.462, y: 0.673, label: 'Dragon Entrance', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'dragonSpawningSoon', weight: 30 }, { signal: 'earlyGame', weight: 10 }, { signal: 'midGame', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 }, { signal: 'roleJungle', weight: 25 }, { signal: 'roleSupport', weight: 15 },
      { signal: 'objectiveJustTaken', weight: 15 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
    ]},
  // #33 Dragon Pit River (red approach)
  { x: 0.684, y: 0.654, label: 'Dragon River', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'dragonSpawningSoon', weight: 25 }, { signal: 'lateGame', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleJungle', weight: 10 }, { signal: 'roleMid', weight: 10 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
    ]},
  // #11 Dragon Tri-Brush
  { x: 0.756, y: 0.722, label: 'Dragon Tri', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'dragonSpawningSoon', weight: 20 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleSupport', weight: 15 },
    ]},
  // #44 Pixel Brush Bot
  { x: 0.515, y: 0.652, label: 'Pixel Brush Bot', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 20 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleMid', weight: 25 }, { signal: 'roleJungle', weight: 15 },
    
      { signal: 'always', weight: 20 }, // Challenger popularity
    ]},

  // ===== MID RIVER =====
  // #7 Mid River Center
  { x: 0.580, y: 0.566, label: 'Mid River', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'midGame', weight: 15 }, { signal: 'lateGame', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleMid', weight: 20 },
    
      { signal: 'always', weight: 10 }, // Challenger popularity
    ]},

  // ===== BARON / HERALD AREA =====
  // #8 Pixel Brush Top
  { x: 0.462, y: 0.469, label: 'Pixel Brush Top', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 20 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleMid', weight: 25 }, { signal: 'roleJungle', weight: 15 },
    
      { signal: 'always', weight: 15 }, // Challenger popularity
    ]},
  // #9 Baron/Herald Entrance
  { x: 0.360, y: 0.441, label: 'Baron Entrance', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'heraldAlive', weight: 35 }, { signal: 'grubsAlive', weight: 30 }, { signal: 'baronSpawningSoon', weight: 40 },
      { signal: 'midGame', weight: 10 }, { signal: 'lateGame', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleJungle', weight: 25 }, { signal: 'roleTop', weight: 20 }, { signal: 'roleSupport', weight: 15 },
      { signal: 'objectiveJustTaken', weight: 15 },
    ]},
  // #32 Baron River Approach
  { x: 0.343, y: 0.346, label: 'Baron River', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'baronSpawningSoon', weight: 35 }, { signal: 'lateGame', weight: 20 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleSupport', weight: 15 }, { signal: 'roleJungle', weight: 15 },
      { signal: 'objectiveJustTaken', weight: 15 },
      { signal: 'always', weight: 10 }, // Challenger popularity
    ]},
  // #43/45 Baron Pit Ward
  { x: 0.464, y: 0.378, label: 'Baron Pit', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'baronSpawningSoon', weight: 40 }, { signal: 'lateGame', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleSupport', weight: 20 }, { signal: 'roleJungle', weight: 20 },
      { signal: 'objectiveJustTaken', weight: 15 },
      { signal: 'always', weight: 5 }, // Challenger popularity
    ]},

  // ===== TOP LANE AREA =====
  // #10 Top River Bush
  { x: 0.269, y: 0.267, label: 'Top River Bush', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleTop', weight: 25 }, { signal: 'roleJungle', weight: 15 },
    ]},
  // #19 Top Lane Entrance
  { x: 0.329, y: 0.239, label: 'Top Lane Entrance', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 15 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleTop', weight: 20 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
    ]},
  // #22 Red Top Tri-Brush
  { x: 0.527, y: 0.253, label: 'Top Tri-Brush', side: 'red', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'earlyGame', weight: 25 }, { signal: 'teamBehind', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 }, { signal: 'roleTop', weight: 20 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #20 Top River Deep
  { x: 0.434, y: 0.318, label: 'Top River Deep', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 10 }, { signal: 'heraldAlive', weight: 20 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'roleTop', weight: 15 }, { signal: 'roleJungle', weight: 15 },
    ]},

  // ===== BLUE SIDE JUNGLE =====
  // #12 Blue Wolves Area
  { x: 0.357, y: 0.529, label: 'Blue Wolves', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 15 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #13 Blue Gromp
  { x: 0.267, y: 0.487, label: 'Blue Gromp', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 15 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #14 Blue Blue Buff
  { x: 0.202, y: 0.367, label: 'Blue Blue Buff', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 20 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 15 }, { signal: 'roleSupport', weight: 10 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #15 Blue Raptors
  { x: 0.253, y: 0.408, label: 'Blue Raptors', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'earlyGame', weight: 10 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 15 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #16 Blue Bot Jungle River
  { x: 0.239, y: 0.647, label: 'Blue Bot Jungle', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 25 },
      { signal: 'recentTeammateDeath', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    
      { signal: 'always', weight: 20 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #28 Blue Gromp (deep)
  { x: 0.118, y: 0.473, label: 'Blue Gromp Deep', side: 'blue', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'teamBehind', weight: 30 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},

  // ===== RED SIDE JUNGLE =====
  // #18 Red Wolves Area
  { x: 0.677, y: 0.589, label: 'Red Wolves', side: 'red', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 }, { signal: 'roleJungle', weight: 15 },
    
      { signal: 'always', weight: 10 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #23 Red Raptors
  { x: 0.659, y: 0.476, label: 'Red Raptors', side: 'red', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'earlyGame', weight: 10 }, { signal: 'midGame', weight: 10 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 }, { signal: 'roleJungle', weight: 15 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #24 Red Gromp
  { x: 0.768, y: 0.531, label: 'Red Gromp', side: 'red', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 }, { signal: 'roleJungle', weight: 15 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #25 Red Blue Buff
  { x: 0.849, y: 0.603, label: 'Red Blue Buff', side: 'red', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 20 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 }, { signal: 'roleJungle', weight: 15 }, { signal: 'roleSupport', weight: 10 },
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #26 Red Top Jungle River
  { x: 0.905, y: 0.524, label: 'Red Top Jungle', side: 'red', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 25 },
      { signal: 'recentTeammateDeath', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    
      { signal: 'always', weight: 5 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},
  // #34 Red Bot Lane Deep
  { x: 0.791, y: 0.666, label: 'Red Bot Jungle', side: 'red', type: 'defensive', // +urgentDefensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamBehind', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    
      { signal: 'always', weight: 10 }, // Challenger popularity
      { signal: 'urgentDefensive', weight: 25 },
    ]},

  // ===== ENEMY JUNGLE (offensive wards) =====
  // #21 Red Raptors (enemy for blue)
  { x: 0.564, y: 0.341, label: 'Enemy Raptors', side: 'blue', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'earlyGame', weight: 15 }, { signal: 'midGame', weight: 10 }, { signal: 'teamAhead', weight: 25 },
      { signal: 'recentEnemyKill', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 20 },
    
      { signal: 'always', weight: 20 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  // #30 Red Red Buff (enemy for blue)
  { x: 0.657, y: 0.244, label: 'Enemy Red Buff', side: 'blue', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'midGame', weight: 15 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 20 },
    
      { signal: 'always', weight: 10 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  // #31 Red Gromp (enemy for blue)
  { x: 0.775, y: 0.353, label: 'Enemy Gromp', side: 'blue', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'midGame', weight: 10 }, { signal: 'teamAhead', weight: 20 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 }, { signal: 'roleJungle', weight: 20 },
    
      { signal: 'always', weight: 15 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  // #6 Blue Raptors (enemy for red) — reuses dragon entrance position
  { x: 0.462, y: 0.673, label: 'Enemy Raptors', side: 'red', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'earlyGame', weight: 15 }, { signal: 'midGame', weight: 10 }, { signal: 'teamAhead', weight: 25 },
      { signal: 'recentEnemyKill', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 }, { signal: 'roleJungle', weight: 20 },
    
      { signal: 'always', weight: 20 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  // #16 Blue Blue Buff (enemy for red)
  { x: 0.239, y: 0.647, label: 'Enemy Blue Buff', side: 'red', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'midGame', weight: 15 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 }, { signal: 'roleJungle', weight: 20 },
      { signal: 'urgentOffensive', weight: 20 },
    ]},

  // ===== TOP LANE DEEP (red base approach) =====
  // #27 Red Base Top Approach
  { x: 0.383, y: 0.169, label: 'Red Base Approach', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 15 }, { signal: 'teamAhead', weight: 20 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  // #29 Red Top Tri-Brush
  { x: 0.464, y: 0.104, label: 'Red Top Lane Brush', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 15 }, { signal: 'activePlayerAlive', weight: 5 }, { signal: 'roleTop', weight: 20 },
    ]},

  // ===== RED BASE AREA (deep wards) =====
  // #35-38 Red base corners — for very late game / siege
  { x: 0.160, y: 0.176, label: 'Red Base Top', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 20 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  { x: 0.204, y: 0.144, label: 'Red Base Gate', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 20 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
    
      { signal: 'always', weight: 15 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  { x: 0.132, y: 0.227, label: 'Red Nexus Area', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 15 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
    
      { signal: 'always', weight: 15 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},

  // ===== BLUE BASE AREA (deep wards) =====
  // #39-42 Blue base corners
  { x: 0.819, y: 0.882, label: 'Blue Base Bot', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 20 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
    
      { signal: 'always', weight: 20 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  { x: 0.845, y: 0.838, label: 'Blue Base Gate', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 20 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  { x: 0.879, y: 0.794, label: 'Blue Bot Outer', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 15 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
    
      { signal: 'always', weight: 20 }, // Challenger popularity
      { signal: 'urgentOffensive', weight: 20 },
    ]},
  { x: 0.882, y: 0.854, label: 'Blue Nexus Area', side: 'both', type: 'offensive', // +urgentOffensive
    conditions: [
      { signal: 'lateGame', weight: 15 }, { signal: 'teamAhead', weight: 25 }, { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'urgentOffensive', weight: 20 },
    ]},
];

export function getWardSuggestions(state: GameState): ScoredWardSpot[] {
  const scored: ScoredWardSpot[] = [];

  for (const ward of wardDefinitions) {
    // Filter by side
    if (ward.side !== 'both' && ward.side !== state.side) continue;

    const score = evaluateScore(ward.conditions, state);
    if (score <= 0) continue;

    scored.push({
      x: ward.x,
      y: ward.y,
      label: ward.label,
      type: ward.type,
      score
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Support always shows 5 spots, others show wardCount + 2 (min 3)
  const maxSpots = state.activePlayerRole === 'support' ? 5 : Math.max(state.wardCount + 2, 3);
  return scored.slice(0, maxSpots);
}
