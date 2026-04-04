export type GamePhase = 'early' | 'mid' | 'late';
export type TeamSide = 'blue' | 'red';
export type WardType = 'offensive' | 'defensive' | 'neutral';
export type PlayerRole = 'top' | 'jungle' | 'mid' | 'bottom' | 'support' | 'unknown';

export interface GameEvent {
  eventName: string;
  eventTime: number;
  killerName?: string;
  dragonType?: string;
  isTeamKill?: boolean;   // true if killer is on our team
}

export interface ActiveBoost {
  signal: string;
  expiresAt: number;  // game time in seconds when boost expires
}

export interface GameState {
  // Core
  phase: GamePhase;
  side: TeamSide;
  matchActive: boolean;
  gameTime: number;

  // Team economy
  teamGold: number;
  enemyGold: number;
  goldAdvantage: number;
  teamKills: number;
  enemyKills: number;

  // Active player
  activePlayerChampion: string;
  activePlayerLevel: number;
  activePlayerDead: boolean;
  activePlayerRole: PlayerRole;
  activePlayerKills: number;
  activePlayerDeaths: number;
  activePlayerAssists: number;
  activePlayerWardScore: number;
  teamAvgWardScore: number;
  wardCount: number;

  // Objectives
  dragonsKilled: number;
  enemyDragonsKilled: number;
  grubsKilled: number;
  enemyGrubsKilled: number;
  heraldKilled: boolean;
  enemyHeraldKilled: boolean;
  baronAlive: boolean;
  dragonAlive: boolean;
  heraldAlive: boolean;
  grubsAlive: boolean;
  lastDragonKillTime: number;
  lastBaronKillTime: number;
  lastHeraldKillTime: number;
  lastGrubsKillTime: number;

  // Recent events
  recentEvents: GameEvent[];

  // Temporary boosts from GEP events
  activeBoosts: ActiveBoost[];
}

export interface WardCondition {
  signal: string;
  weight: number;
}

export interface WardDefinition {
  x: number;
  y: number;
  label: string;
  side: TeamSide | 'both';
  type: WardType;
  conditions: WardCondition[];
}

export interface ScoredWardSpot {
  x: number;
  y: number;
  label: string;
  type: WardType;
  score: number;
}

export interface GameTip {
  text: string;
  type: 'positive' | 'improvement';
}

export interface GameSummary {
  matchId: string;
  champion: string;
  role: PlayerRole;
  side: TeamSide;
  win: boolean;
  duration: number;
  kills: number;
  deaths: number;
  assists: number;
  wardScore: number;
  teamAvgWardScore: number;
  wardScoreTimeline: { time: number; score: number }[];
  dragonsKilled: number;
  enemyDragonsKilled: number;
  baronsKilled: number;
  heraldsKilled: number;
  grubsKilled: number;
  earlyGameWardScore: number;
  midGameWardScore: number;
  lateGameWardScore: number;
  tips: GameTip[];
  timestamp: number;
}

/** Minimap position and size in screen pixels */
export interface MinimapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Persisted minimap configuration */
export interface MinimapConfig {
  mode: 'auto' | 'manual';
  manualBounds: (MinimapBounds & { gameWidth: number; gameHeight: number }) | null;
  sideOverride: 'left' | 'right' | null;
}
