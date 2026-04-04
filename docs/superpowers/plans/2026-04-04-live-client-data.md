# Live Client Data API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static phase-based ward suggestions with a dynamic scoring system powered by League's Live Client Data API, producing intelligent ward recommendations based on real-time game state.

**Architecture:** `LiveClientPoller` polls `https://127.0.0.1:2999/liveclientdata/allgamedata` every 3s via `overwolf.web.sendHttpRequest`. `GameStateManager` merges this data with GEP events into a unified rich `GameState`. `WardScoringEngine` evaluates ward definitions against game state using weighted conditions. `MinimapOverlay` renders the top `wardCount + 2` spots, with defensive wards in pink and others in cyan.

**Tech Stack:** TypeScript, Overwolf API (`overwolf.web`, `overwolf.games`), League Live Client Data API

**Spec:** `docs/superpowers/specs/2026-04-04-live-client-data-design.md`

---

## File Structure

```
src/
├── types.ts                         # Modified: rich GameState, GameEvent, WardType, WardCondition, WardDefinition, ScoredWardSpot
├── features/
│   ├── live-client.ts               # New: polls Live Client Data API every 3s
│   ├── game-state.ts                # Rewrite: unified state from GEP + live client data
│   ├── ward-data.ts                 # Rewrite: condition-based scoring engine
│   ├── minimap-overlay.ts           # Modified: accept ScoredWardSpot[], render pink/cyan
│   ├── minimap-config.ts            # Unchanged
│   └── calibration-ui.ts            # Unchanged
├── in_game/
│   ├── in_game.ts                   # Modified: start/stop poller, new update flow
│   └── in_game.html                 # Unchanged
public/
├── css/
│   └── in_game.css                  # Modified: add pink ward marker style
```

---

### Task 1: Update types.ts — rich game state and ward scoring types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Replace types.ts**

```typescript
export type GamePhase = 'early' | 'mid' | 'late';
export type TeamSide = 'blue' | 'red';
export type WardType = 'offensive' | 'defensive' | 'neutral';

export interface GameEvent {
  eventName: string;
  eventTime: number;
  killerName?: string;
  dragonType?: string;
  isTeamKill?: boolean;   // true if killer is on our team
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: expand types with rich GameState, ward scoring, and event types"
```

---

### Task 2: Create live-client.ts — API polling module

**Files:**
- Create: `src/features/live-client.ts`

- [ ] **Step 1: Create live-client.ts**

```typescript
type LiveClientCallback = (data: any) => void;

const API_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
const POLL_INTERVAL = 3000;

export class LiveClientPoller {
  private _callback: LiveClientCallback;
  private _intervalId: number | null = null;
  private _active: boolean = false;

  constructor(callback: LiveClientCallback) {
    this._callback = callback;
  }

  public start(): void {
    if (this._active) return;
    this._active = true;
    this.poll();
    this._intervalId = window.setInterval(() => this.poll(), POLL_INTERVAL);
    console.log('LiveClientPoller started');
  }

  public stop(): void {
    this._active = false;
    if (this._intervalId !== null) {
      window.clearInterval(this._intervalId);
      this._intervalId = null;
    }
    console.log('LiveClientPoller stopped');
  }

  private poll(): void {
    if (!this._active) return;

    try {
      overwolf.web.sendHttpRequest(
        API_URL,
        overwolf.web.enums.HttpRequestMethods.GET,
        [],
        '',
        (result) => {
          if (result.success && result.data) {
            try {
              const parsed = JSON.parse(result.data);
              this._callback(parsed);
            } catch (e) {
              // JSON parse error — skip this poll
            }
          }
          // Silently ignore failures — API not ready yet
        }
      );
    } catch (e) {
      // Overwolf API not available — skip
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/live-client.ts
git commit -m "feat: add LiveClientPoller for Live Client Data API"
```

---

### Task 3: Rewrite game-state.ts — unified state manager

**Files:**
- Modify: `src/features/game-state.ts`

- [ ] **Step 1: Replace game-state.ts**

```typescript
import { GameState, GamePhase, GameEvent, TeamSide } from '../types';

type GameStateCallback = (state: GameState) => void;

const EARLY_GAME_END = 14 * 60;
const MID_GAME_END = 25 * 60;

// Objective spawn/respawn times in seconds
const DRAGON_FIRST_SPAWN = 5 * 60;
const DRAGON_RESPAWN = 5 * 60;
const BARON_FIRST_SPAWN = 20 * 60;
const BARON_RESPAWN = 6 * 60;
const HERALD_FIRST_SPAWN = 14 * 60;
const HERALD_DESPAWN = 19 * 60 + 45;
const GRUBS_FIRST_SPAWN = 5 * 60;
const GRUBS_DESPAWN = 14 * 60;

// Ward-related item IDs (Riot item IDs)
const CONTROL_WARD_ID = 2055;
const WARDING_TOTEM_ID = 3340;
const FARSIGHT_ALTERATION_ID = 3363;
const ORACLE_LENS_ID = 3364;

// Support items that grant wards
const SUPPORT_WARD_ITEMS = [3850, 3851, 3853, 3854, 3855, 3857, 3858, 3859, 3860, 3862, 3863, 3864];

function derivePhase(gameTimeSeconds: number): GamePhase {
  if (gameTimeSeconds < EARLY_GAME_END) return 'early';
  if (gameTimeSeconds < MID_GAME_END) return 'mid';
  return 'late';
}

function createDefaultState(): GameState {
  return {
    phase: 'early',
    side: 'blue',
    matchActive: false,
    gameTime: 0,
    teamGold: 0,
    enemyGold: 0,
    goldAdvantage: 0,
    teamKills: 0,
    enemyKills: 0,
    activePlayerChampion: '',
    activePlayerLevel: 1,
    activePlayerDead: false,
    wardCount: 0,
    dragonsKilled: 0,
    enemyDragonsKilled: 0,
    grubsKilled: 0,
    enemyGrubsKilled: 0,
    heraldKilled: false,
    enemyHeraldKilled: false,
    baronAlive: false,
    dragonAlive: false,
    heraldAlive: false,
    grubsAlive: false,
    lastDragonKillTime: 0,
    lastBaronKillTime: 0,
    lastHeraldKillTime: 0,
    lastGrubsKillTime: 0,
    recentEvents: []
  };
}

export class GameStateManager {
  private _callback: GameStateCallback | null = null;
  private _state: GameState = createDefaultState();
  private _playerTeam: string = 'ORDER'; // ORDER = blue, CHAOS = red
  private _lastEventId: number = -1;
  private _teammateNames: Set<string> = new Set();

  public onGameStateChanged(callback: GameStateCallback): void {
    this._callback = callback;
  }

  public getState(): GameState {
    return { ...this._state };
  }

  /** Called with raw Live Client Data API response every 3s */
  public updateFromLiveClient(data: any): void {
    if (!data) return;

    this._state.matchActive = true;

    // Game time
    if (data.gameData && data.gameData.gameTime !== undefined) {
      this._state.gameTime = data.gameData.gameTime;
      this._state.phase = derivePhase(data.gameData.gameTime);
    }

    // Active player — get champion name and level
    if (data.activePlayer) {
      this._state.activePlayerChampion = data.activePlayer.championName || '';
      this._state.activePlayerLevel = data.activePlayer.level || 1;
    }

    // All players — determine team, calculate totals
    if (data.allPlayers && Array.isArray(data.allPlayers)) {
      // First: find active player in allPlayers to determine team
      const activeChampion = this._state.activePlayerChampion;
      for (const player of data.allPlayers) {
        if (player.championName === activeChampion && player.team) {
          this._playerTeam = player.team;
          this._state.side = player.team === 'ORDER' ? 'blue' : 'red';
          break;
        }
      }
      let teamKills = 0;
      let enemyKills = 0;
      let playerDead = false;
      let wardCount = 0;
      this._teammateNames.clear();

      for (const player of data.allPlayers) {
        const isTeammate = player.team === this._playerTeam;
        const kills = player.scores?.kills || 0;
        const summonerName = player.summonerName || player.riotIdGameName || '';

        if (isTeammate) {
          teamKills += kills;
          this._teammateNames.add(summonerName);

          // Check if this is the active player
          if (player.championName === this._state.activePlayerChampion) {
            playerDead = player.isDead || false;
            wardCount = this.countWards(player);
          }
        } else {
          enemyKills += kills;
        }
      }

      this._state.teamKills = teamKills;
      this._state.enemyKills = enemyKills;
      this._state.activePlayerDead = playerDead;
      this._state.wardCount = wardCount;

      // Gold advantage approximation from kill difference
      // (Live Client API doesn't expose total team gold)
      this._state.goldAdvantage = (teamKills - enemyKills) * 300;
      this._state.teamGold = 0;
      this._state.enemyGold = 0;
    }

    // Events — process new events for objectives
    if (data.events && data.events.Events) {
      this.processEvents(data.events.Events);
    }

    // Derive objective alive states
    this.deriveObjectiveStates();

    // Notify listener
    if (this._callback) {
      this._callback(this._state);
    }
  }

  /** Called when GEP match_info events arrive (fallback) */
  public updateFromMatchInfo(info: any): void {
    if (info.game_time !== undefined) {
      this._state.gameTime = info.game_time;
      this._state.phase = derivePhase(info.game_time);
    }

    if (info.team_side !== undefined) {
      this._state.side = info.team_side as TeamSide;
    }

    if (info.match_active !== undefined) {
      this._state.matchActive = info.match_active;
    }

    if (this._callback) {
      this._callback(this._state);
    }
  }

  private countWards(player: any): number {
    let count = 0;
    if (!player.items) return 0;

    for (const item of player.items) {
      const id = item.itemID;
      // Control wards in inventory
      if (id === CONTROL_WARD_ID) {
        count += item.count || 1;
      }
      // Warding totem — assume 1 charge (API doesn't expose charges directly)
      if (id === WARDING_TOTEM_ID) {
        count += 1;
      }
      // Support ward items
      if (SUPPORT_WARD_ITEMS.includes(id)) {
        count += 1;
      }
    }

    return count;
  }

  private processEvents(events: any[]): void {
    const now = this._state.gameTime;

    for (const event of events) {
      if (event.EventID <= this._lastEventId) continue;
      this._lastEventId = event.EventID;

      const isTeam = this.isTeamEvent(event);
      const gameEvent: GameEvent = {
        eventName: event.EventName,
        eventTime: event.EventTime,
        killerName: event.KillerName,
        dragonType: event.DragonType,
        isTeamKill: isTeam
      };

      // Track objective kills
      switch (event.EventName) {
        case 'DragonKill':
          this._state.lastDragonKillTime = event.EventTime;
          if (this.isTeamEvent(event)) {
            this._state.dragonsKilled++;
          } else {
            this._state.enemyDragonsKilled++;
          }
          break;

        case 'BaronKill':
          this._state.lastBaronKillTime = event.EventTime;
          break;

        case 'HeraldKill':
          this._state.lastHeraldKillTime = event.EventTime;
          if (this.isTeamEvent(event)) {
            this._state.heraldKilled = true;
          } else {
            this._state.enemyHeraldKilled = true;
          }
          break;

        case 'HordeKill':
          this._state.lastGrubsKillTime = event.EventTime;
          if (this.isTeamEvent(event)) {
            this._state.grubsKilled++;
          } else {
            this._state.enemyGrubsKilled++;
          }
          break;
      }

      // Keep recent events (last 30 seconds)
      this._state.recentEvents.push(gameEvent);
    }

    // Prune old events
    this._state.recentEvents = this._state.recentEvents.filter(
      e => now - e.eventTime < 30
    );
  }

  private isTeamEvent(event: any): boolean {
    if (!event.KillerName) return false;
    return this._teammateNames.has(event.KillerName);
  }

  private deriveObjectiveStates(): void {
    const t = this._state.gameTime;

    // Dragon
    if (t < DRAGON_FIRST_SPAWN) {
      this._state.dragonAlive = false;
    } else if (this._state.lastDragonKillTime === 0) {
      // No dragon killed yet and past first spawn — dragon is alive
      this._state.dragonAlive = t >= DRAGON_FIRST_SPAWN;
    } else {
      this._state.dragonAlive = (t - this._state.lastDragonKillTime) >= DRAGON_RESPAWN;
    }

    // Baron
    if (t < BARON_FIRST_SPAWN) {
      this._state.baronAlive = false;
    } else if (this._state.lastBaronKillTime === 0) {
      this._state.baronAlive = t >= BARON_FIRST_SPAWN;
    } else {
      this._state.baronAlive = (t - this._state.lastBaronKillTime) >= BARON_RESPAWN;
    }

    // Herald
    if (t < HERALD_FIRST_SPAWN || t >= HERALD_DESPAWN) {
      this._state.heraldAlive = false;
    } else if (this._state.lastHeraldKillTime === 0) {
      this._state.heraldAlive = t >= HERALD_FIRST_SPAWN;
    } else {
      this._state.heraldAlive = false; // Herald doesn't respawn (simplified)
    }

    // Grubs
    if (t < GRUBS_FIRST_SPAWN || t >= GRUBS_DESPAWN) {
      this._state.grubsAlive = false;
    } else if (this._state.lastGrubsKillTime === 0) {
      this._state.grubsAlive = t >= GRUBS_FIRST_SPAWN;
    } else {
      this._state.grubsAlive = false; // Simplified — grubs have limited respawns
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/game-state.ts
git commit -m "feat: rewrite GameStateManager with Live Client Data + GEP merge"
```

---

### Task 4: Rewrite ward-data.ts — condition-based scoring engine

**Files:**
- Modify: `src/features/ward-data.ts`

- [ ] **Step 1: Replace ward-data.ts**

```typescript
import { GameState, WardDefinition, ScoredWardSpot, WardCondition } from '../types';

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

// Ward definitions with weighted conditions
const wardDefinitions: WardDefinition[] = [
  // ===== DRAGON AREA =====
  {
    x: 0.66, y: 0.71, label: 'Dragon Pit', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'dragonSpawningSoon', weight: 40 },
      { signal: 'midGame', weight: 15 },
      { signal: 'lateGame', weight: 20 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },
  {
    x: 0.63, y: 0.69, label: 'Dragon Entrance', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'dragonSpawningSoon', weight: 30 },
      { signal: 'earlyGame', weight: 10 },
      { signal: 'midGame', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },
  {
    x: 0.57, y: 0.63, label: 'Dragon River', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'dragonSpawningSoon', weight: 25 },
      { signal: 'lateGame', weight: 15 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },

  // ===== BARON AREA =====
  {
    x: 0.33, y: 0.32, label: 'Baron Pit', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'baronSpawningSoon', weight: 40 },
      { signal: 'lateGame', weight: 25 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },
  {
    x: 0.29, y: 0.28, label: 'Baron Brush', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'baronSpawningSoon', weight: 30 },
      { signal: 'lateGame', weight: 20 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },
  {
    x: 0.42, y: 0.40, label: 'Baron River', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'baronSpawningSoon', weight: 25 },
      { signal: 'lateGame', weight: 15 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },

  // ===== HERALD / GRUBS AREA =====
  {
    x: 0.37, y: 0.33, label: 'Herald Entrance', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'heraldAlive', weight: 35 },
      { signal: 'midGame', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },
  {
    x: 0.35, y: 0.37, label: 'Grubs Area', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'grubsAlive', weight: 35 },
      { signal: 'earlyGame', weight: 15 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },

  // ===== BLUE SIDE — DEFENSIVE =====
  {
    x: 0.47, y: 0.89, label: 'Bot Tri-Brush', side: 'blue', type: 'defensive',
    conditions: [
      { signal: 'earlyGame', weight: 25 },
      { signal: 'teamBehind', weight: 20 },
      { signal: 'teamEven', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    ]
  },
  {
    x: 0.37, y: 0.55, label: 'Blue Jungle River', side: 'blue', type: 'defensive',
    conditions: [
      { signal: 'midGame', weight: 15 },
      { signal: 'teamBehind', weight: 25 },
      { signal: 'recentTeammateDeath', weight: 15 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    ]
  },

  // ===== BLUE SIDE — OFFENSIVE =====
  {
    x: 0.69, y: 0.43, label: 'Enemy Raptors', side: 'blue', type: 'offensive',
    conditions: [
      { signal: 'earlyGame', weight: 15 },
      { signal: 'midGame', weight: 10 },
      { signal: 'teamAhead', weight: 25 },
      { signal: 'recentEnemyKill', weight: 15 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    ]
  },
  {
    x: 0.79, y: 0.23, label: 'Enemy Red Buff', side: 'blue', type: 'offensive',
    conditions: [
      { signal: 'midGame', weight: 15 },
      { signal: 'teamAhead', weight: 25 },
      { signal: 'recentEnemyKill', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    ]
  },

  // ===== BLUE SIDE — NEUTRAL =====
  {
    x: 0.68, y: 0.76, label: 'Bot River Bush', side: 'blue', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 25 },
      { signal: 'teamEven', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    ]
  },
  {
    x: 0.50, y: 0.55, label: 'Pixel Brush Bot', side: 'blue', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 20 },
      { signal: 'midGame', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'blueSide', weight: 5 },
    ]
  },

  // ===== RED SIDE — DEFENSIVE =====
  {
    x: 0.53, y: 0.12, label: 'Top Tri-Brush', side: 'red', type: 'defensive',
    conditions: [
      { signal: 'earlyGame', weight: 25 },
      { signal: 'teamBehind', weight: 20 },
      { signal: 'teamEven', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    ]
  },
  {
    x: 0.63, y: 0.47, label: 'Red Jungle River', side: 'red', type: 'defensive',
    conditions: [
      { signal: 'midGame', weight: 15 },
      { signal: 'teamBehind', weight: 25 },
      { signal: 'recentTeammateDeath', weight: 15 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    ]
  },

  // ===== RED SIDE — OFFENSIVE =====
  {
    x: 0.30, y: 0.46, label: 'Enemy Raptors', side: 'red', type: 'offensive',
    conditions: [
      { signal: 'earlyGame', weight: 15 },
      { signal: 'midGame', weight: 10 },
      { signal: 'teamAhead', weight: 25 },
      { signal: 'recentEnemyKill', weight: 15 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    ]
  },
  {
    x: 0.20, y: 0.77, label: 'Enemy Blue Buff', side: 'red', type: 'offensive',
    conditions: [
      { signal: 'midGame', weight: 15 },
      { signal: 'teamAhead', weight: 25 },
      { signal: 'recentEnemyKill', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    ]
  },

  // ===== RED SIDE — NEUTRAL =====
  {
    x: 0.32, y: 0.25, label: 'Top River Bush', side: 'red', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 25 },
      { signal: 'teamEven', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    ]
  },
  {
    x: 0.48, y: 0.37, label: 'Pixel Brush Top', side: 'red', type: 'neutral',
    conditions: [
      { signal: 'earlyGame', weight: 20 },
      { signal: 'midGame', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
      { signal: 'redSide', weight: 5 },
    ]
  },

  // ===== MID RIVER (both sides) =====
  {
    x: 0.50, y: 0.50, label: 'Mid River', side: 'both', type: 'neutral',
    conditions: [
      { signal: 'lateGame', weight: 15 },
      { signal: 'midGame', weight: 10 },
      { signal: 'activePlayerAlive', weight: 5 },
    ]
  },
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

  // Return top wardCount + 2 spots
  const maxSpots = Math.max(state.wardCount + 2, 3);
  return scored.slice(0, maxSpots);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/ward-data.ts
git commit -m "feat: rewrite ward-data with condition-based scoring engine"
```

---

### Task 5: Update minimap-overlay.ts — support ScoredWardSpot with pink/cyan rendering

**Files:**
- Modify: `src/features/minimap-overlay.ts`

- [ ] **Step 1: Replace minimap-overlay.ts**

```typescript
import { ScoredWardSpot, MinimapBounds } from '../types';
import { MinimapConfigManager } from './minimap-config';

interface RenderedMarker {
  id: string;
  element: HTMLElement;
  spot: ScoredWardSpot;
}

function spotId(spot: ScoredWardSpot): string {
  return `${spot.x.toFixed(4)}_${spot.y.toFixed(4)}_${spot.label}`;
}

export class MinimapOverlay {
  private _container: HTMLElement | null = null;
  private _configManager: MinimapConfigManager;
  private _renderedMarkers: Map<string, RenderedMarker> = new Map();
  private _visible: boolean = true;
  private _lastSpotKey: string = '';

  constructor(configManager: MinimapConfigManager) {
    this._configManager = configManager;
  }

  public init(container: HTMLElement): void {
    this._container = container;
  }

  public show(spots: ScoredWardSpot[]): void {
    if (!this._container) return;
    this._visible = true;
    this._container.style.display = 'block';
    this.update(spots);
  }

  public hide(): void {
    if (!this._container) return;
    this._visible = false;
    this._container.style.display = 'none';
    this.clearAll();
  }

  /** Update displayed ward markers with DOM diffing */
  public update(spots: ScoredWardSpot[]): void {
    if (!this._visible || !this._container) return;

    // Skip re-render if spots haven't changed
    const spotKey = spots.map(s => spotId(s)).join('|');
    if (spotKey === this._lastSpotKey) return;
    this._lastSpotKey = spotKey;

    const bounds = this._configManager.getMinimapBounds();
    const newSpotIds = new Set<string>();

    for (const spot of spots) {
      const id = spotId(spot);
      newSpotIds.add(id);

      const existing = this._renderedMarkers.get(id);
      if (existing) {
        this.positionMarker(existing.element, spot, bounds);
        this.styleMarker(existing.element, spot);
      } else {
        const element = this.createMarkerElement(spot, bounds);
        this._container.appendChild(element);
        this._renderedMarkers.set(id, { id, element, spot });
      }
    }

    for (const [id, marker] of this._renderedMarkers) {
      if (!newSpotIds.has(id)) {
        marker.element.remove();
        this._renderedMarkers.delete(id);
      }
    }
  }

  public repositionAll(): void {
    if (!this._visible) return;
    const bounds = this._configManager.getMinimapBounds();
    for (const marker of this._renderedMarkers.values()) {
      this.positionMarker(marker.element, marker.spot, bounds);
    }
  }

  private createMarkerElement(spot: ScoredWardSpot, bounds: MinimapBounds): HTMLElement {
    const marker = document.createElement('div');
    marker.className = 'ward-marker';
    marker.setAttribute('data-label', spot.label);
    marker.title = spot.label;
    this.positionMarker(marker, spot, bounds);
    this.styleMarker(marker, spot);
    return marker;
  }

  private styleMarker(element: HTMLElement, spot: ScoredWardSpot): void {
    if (spot.type === 'defensive') {
      element.classList.add('ward-marker-defensive');
      element.classList.remove('ward-marker-offensive');
    } else if (spot.type === 'offensive') {
      element.classList.add('ward-marker-offensive');
      element.classList.remove('ward-marker-defensive');
    } else {
      element.classList.remove('ward-marker-defensive', 'ward-marker-offensive');
    }
  }

  private positionMarker(element: HTMLElement, spot: ScoredWardSpot, bounds: MinimapBounds): void {
    const screenX = bounds.x + (spot.x * bounds.width);
    const screenY = bounds.y + (spot.y * bounds.height);
    element.style.left = `${Math.round(screenX)}px`;
    element.style.top = `${Math.round(screenY)}px`;
  }

  private clearAll(): void {
    for (const marker of this._renderedMarkers.values()) {
      marker.element.remove();
    }
    this._renderedMarkers.clear();
    this._lastSpotKey = '';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/minimap-overlay.ts
git commit -m "feat: update overlay for ScoredWardSpot with pink/cyan rendering"
```

---

### Task 6: Update in_game.css — pink ward marker style

**Files:**
- Modify: `public/css/in_game.css`

- [ ] **Step 1: Add ward type styles after the `.ward-marker:hover` block in in_game.css**

Add immediately after the `.ward-marker:hover { ... }` closing brace (before the calibration styles):

```css

/* Defensive ward markers — pink */
.ward-marker-defensive {
  background-color: rgba(255, 105, 180, 0.5);
  border-color: rgba(255, 105, 180, 0.9);
}

.ward-marker-defensive:hover {
  background-color: rgba(255, 105, 180, 0.8);
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/in_game.css
git commit -m "feat: add pink defensive ward marker style"
```

---

### Task 7: Rewrite in_game.ts — wire live client poller and new update flow

**Files:**
- Modify: `src/in_game/in_game.ts`

- [ ] **Step 1: Replace in_game.ts**

```typescript
import {
  OWGames,
  OWGamesEvents,
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../AppWindow";
import { kHotkeys, kWindowNames, kLeagueFeatures } from "../consts";
import { GameStateManager } from "../features/game-state";
import { MinimapOverlay } from "../features/minimap-overlay";
import { MinimapConfigManager } from "../features/minimap-config";
import { CalibrationUI } from "../features/calibration-ui";
import { LiveClientPoller } from "../features/live-client";
import { getWardSuggestions } from "../features/ward-data";

import WindowState = overwolf.windows.WindowStateEx;

class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _gameState: GameStateManager;
  private _overlay: MinimapOverlay;
  private _minimapConfig: MinimapConfigManager;
  private _calibrationUI: CalibrationUI | null = null;
  private _liveClient: LiveClientPoller;
  private _interactive: boolean = false;

  private constructor() {
    super(kWindowNames.inGame);

    this._minimapConfig = new MinimapConfigManager();
    this._gameState = new GameStateManager();
    this._overlay = new MinimapOverlay(this._minimapConfig);

    // Live Client Data poller — feeds into game state manager
    this._liveClient = new LiveClientPoller((data) => {
      this._gameState.updateFromLiveClient(data);
    });

    const overlayContainer = document.getElementById('overlayContainer');
    if (overlayContainer) {
      this._overlay.init(overlayContainer);
      this._calibrationUI = new CalibrationUI(this._minimapConfig, overlayContainer);
    }

    // Wire game state changes to overlay updates
    this._gameState.onGameStateChanged((state) => {
      const spots = getWardSuggestions(state);
      this._overlay.update(spots);
    });

    // Wire calibrate button
    const calibrateBtn = document.getElementById('calibrateButton');
    if (calibrateBtn) {
      calibrateBtn.addEventListener('click', () => {
        console.log('Calibrate clicked');
        this.startCalibration();
      });
    }

    // Wire reset calibration button
    const resetBtn = document.getElementById('resetCalibrationButton');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._minimapConfig.resetToAuto();
        this._overlay.repositionAll();
        console.log('Calibration reset to auto-detect');
      });
    }

    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
    this.listenForResolutionChanges();

    // Start in pass-through mode after everything is wired
    this.updateHeaderVisibility();
    this.initClickthrough();
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }

    return this._instance;
  }

  public async run() {
    // Resize window to fill game screen
    await this.fillGameScreen();

    // Initialize minimap config with game resolution
    await this._minimapConfig.init();

    // Start GEP listener (fallback data source)
    this._gameEventsListener = new OWGamesEvents(
      {
        onInfoUpdates: this.onInfoUpdates.bind(this),
        onNewEvents: this.onNewEvents.bind(this)
      },
      kLeagueFeatures
    );
    this._gameEventsListener.start();

    // Start Live Client Data poller (primary data source)
    this._liveClient.start();

    // Show initial ward suggestions
    const state = this._gameState.getState();
    const spots = getWardSuggestions(state);
    console.log(`Initial wards: ${spots.length} spots`);
    this._overlay.show(spots);
  }

  private async fillGameScreen(): Promise<void> {
    try {
      const gameInfo = await OWGames.getRunningGameInfo();
      if (gameInfo && gameInfo.width && gameInfo.height) {
        console.log(`Game resolution: ${gameInfo.width}x${gameInfo.height}`);

        const windowResult = await new Promise<overwolf.windows.WindowResult>((resolve) => {
          overwolf.windows.getCurrentWindow((result) => resolve(result));
        });

        if (windowResult && windowResult.window) {
          const winId = windowResult.window.id;

          await new Promise<void>((resolve) => {
            overwolf.windows.changePosition(winId, 0, 0, () => resolve());
          });

          await new Promise<void>((resolve) => {
            overwolf.windows.changeSize(winId, gameInfo.width, gameInfo.height, () => resolve());
          });

          console.log(`Window resized to ${gameInfo.width}x${gameInfo.height}`);
        }
      }
    } catch (e) {
      console.warn('Could not resize window to game resolution', e);
    }
  }

  private startCalibration(): void {
    if (this._calibrationUI && !this._calibrationUI.isActive()) {
      this._calibrationUI.start(
        () => { this._overlay.repositionAll(); },
        () => { }
      );
    }
  }

  private listenForResolutionChanges(): void {
    overwolf.games.onGameInfoUpdated.addListener((event) => {
      if (event && event.gameInfo) {
        const info = event.gameInfo;
        if (info.width && info.height) {
          const currentRes = this._minimapConfig.getGameResolution();
          if (info.width !== currentRes.width || info.height !== currentRes.height) {
            this._minimapConfig.updateResolution(info.width, info.height);
            this._overlay.repositionAll();
          }
        }
      }
    });
  }

  private onInfoUpdates(info) {
    this._gameState.updateFromMatchInfo(info);
  }

  private onNewEvents(e) {
    // GEP events — currently handled by Live Client Data poller
  }

  protected async setDrag(elem) {
    // no-op — full-screen overlay doesn't need window dragging
  }

  private async setToggleHotkeyText() {
    const gameClassId = await this.getCurrentGameClassId();
    const hotkeyText = await OWHotkeys.getHotkeyText(kHotkeys.toggle, gameClassId);
    const hotkeyElem = document.getElementById('hotkey');
    if (hotkeyElem) {
      hotkeyElem.textContent = hotkeyText;
    }
  }

  private async setToggleHotkeyBehavior() {
    const toggleInteractive = async (
      hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent
    ): Promise<void> => {
      this._interactive = !this._interactive;
      this.setClickthrough(!this._interactive);
      this.updateHeaderVisibility();
    }

    OWHotkeys.onHotkeyDown(kHotkeys.toggle, toggleInteractive);
  }

  private _windowId: string = '';

  private async initClickthrough(): Promise<void> {
    try {
      this._windowId = await this.getWindowId();
      this.setClickthrough(true);
    } catch (e) {
      console.warn('Could not initialize clickthrough', e);
    }
  }

  private setClickthrough(enabled: boolean): void {
    if (!this._windowId) return;
    try {
      if (enabled) {
        overwolf.windows.setWindowStyle(this._windowId, overwolf.windows.enums.WindowStyle.InputPassThrough, (res) => {
          console.log('setWindowStyle InputPassThrough:', res);
        });
      } else {
        overwolf.windows.removeWindowStyle(this._windowId, overwolf.windows.enums.WindowStyle.InputPassThrough, (res) => {
          console.log('removeWindowStyle InputPassThrough:', res);
        });
      }
    } catch (e) {
      console.warn('setClickthrough failed', e);
    }
  }

  private getWindowId(): Promise<string> {
    return new Promise((resolve, reject) => {
      overwolf.windows.getCurrentWindow((result) => {
        if (result && result.window) {
          resolve(result.window.id);
        } else {
          reject(new Error('Could not get current window'));
        }
      });
    });
  }

  private updateHeaderVisibility(): void {
    const header = document.getElementById('header');
    if (header) {
      header.style.display = this._interactive ? 'flex' : 'none';
    }
  }

  private async getCurrentGameClassId(): Promise<number | null> {
    const info = await OWGames.getRunningGameInfo();
    return (info && info.isRunning && info.classId) ? info.classId : null;
  }
}

InGame.instance().run();
```

- [ ] **Step 2: Commit**

```bash
git add src/in_game/in_game.ts
git commit -m "feat: wire LiveClientPoller and scoring-based ward updates"
```

---

### Task 8: Verify build

**Files:** None (verification only)

- [ ] **Step 1: Run webpack build**

```bash
npx webpack --mode=development
```

Expected: Build succeeds without errors.

- [ ] **Step 2: Build .opk package**

```bash
npm run build
```

Expected: Build succeeds, .opk created in `releases/`.

- [ ] **Step 3: Commit if needed**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore: build verification"
```
