import { GameState, GamePhase, GameEvent, TeamSide, PlayerRole, ActiveBoost } from '../types';

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
    activePlayerRole: 'unknown',
    activePlayerKills: 0,
    activePlayerDeaths: 0,
    activePlayerAssists: 0,
    activePlayerWardScore: 0,
    teamAvgWardScore: 0,
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
    recentEvents: [],
    activeBoosts: []
  };
}

export class GameStateManager {
  private _callback: GameStateCallback | null = null;
  private _state: GameState = createDefaultState();
  private _playerTeam: string = 'ORDER'; // ORDER = blue, CHAOS = red
  private _lastEventId: number = -1;
  private _teammateNames: Set<string> = new Set();
  private _activePlayerSummonerName: string = '';

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
      // championName may be empty early in game — also try riotIdGameName/summonerName
      const champName = data.activePlayer.championName || '';
      const summName = data.activePlayer.summonerName || data.activePlayer.riotIdGameName || '';
      this._state.activePlayerLevel = data.activePlayer.level || 1;

      // Store whatever identifier we have
      if (champName) {
        this._state.activePlayerChampion = champName;
      }
      // Store summoner name for matching in allPlayers
      this._activePlayerSummonerName = summName;
    }

    // All players — determine team, calculate totals
    if (data.allPlayers && Array.isArray(data.allPlayers)) {
      // First: find active player in allPlayers to determine team
      // Match by champion name OR summoner name (championName may be empty early)
      const activeChampion = this._state.activePlayerChampion;
      const activeSummoner = this._activePlayerSummonerName;
      for (const player of data.allPlayers) {
        const matchByChamp = activeChampion && player.championName === activeChampion;
        const matchBySummoner = activeSummoner && (
          player.summonerName === activeSummoner ||
          player.riotIdGameName === activeSummoner
        );

        if ((matchByChamp || matchBySummoner) && player.team) {
          this._playerTeam = player.team;
          this._state.side = player.team === 'ORDER' ? 'blue' : 'red';
          this._state.activePlayerRole = this.mapRole(player.position);
          // Also pick up champion name if we didn't have it
          if (!activeChampion && player.championName) {
            this._state.activePlayerChampion = player.championName;
          }
          break;
        }
      }
      let teamKills = 0;
      let enemyKills = 0;
      let playerDead = false;
      let wardCount = 0;
      let teamWardScoreTotal = 0;
      let teamPlayerCount = 0;
      this._teammateNames.clear();

      for (const player of data.allPlayers) {
        const isTeammate = player.team === this._playerTeam;
        const kills = player.scores?.kills || 0;
        const playerWardScore = player.scores?.wardScore || 0;
        const summonerName = player.summonerName || player.riotIdGameName || '';

        if (isTeammate) {
          teamKills += kills;
          teamWardScoreTotal += playerWardScore;
          teamPlayerCount++;
          this._teammateNames.add(summonerName);

          // Check if this is the active player
          if (player.championName === this._state.activePlayerChampion) {
            playerDead = player.isDead || false;
            wardCount = this.countWards(player);
            this._state.activePlayerKills = player.scores?.kills || 0;
            this._state.activePlayerDeaths = player.scores?.deaths || 0;
            this._state.activePlayerAssists = player.scores?.assists || 0;
            this._state.activePlayerWardScore = playerWardScore;
          }
        } else {
          enemyKills += kills;
        }
      }

      this._state.teamKills = teamKills;
      this._state.enemyKills = enemyKills;
      this._state.activePlayerDead = playerDead;
      this._state.wardCount = wardCount;
      this._state.teamAvgWardScore = teamPlayerCount > 0 ? teamWardScoreTotal / teamPlayerCount : 0;

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

    // Prune expired boosts
    this.pruneBoosts();

    // Notify listener
    if (this._callback) {
      this._callback(this._state);
    }
  }

  private mapRole(position: string): PlayerRole {
    switch ((position || '').toUpperCase()) {
      case 'TOP': return 'top';
      case 'JUNGLE': return 'jungle';
      case 'MIDDLE': return 'mid';
      case 'BOTTOM': return 'bottom';
      case 'UTILITY': return 'support';
      default: return 'unknown';
    }
  }

  /** Called when GEP match_info events arrive (fallback) */
  /** Handle GEP events for instant reactions */
  public handleGepEvent(events: any[]): void {
    for (const event of events) {
      const name = event.name || '';

      switch (name) {
        case 'kill':
          this.addBoost('urgentOffensive', 20);
          break;
        case 'death':
          this.addBoost('urgentDefensive', 20);
          break;
        case 'assist':
          this.addBoost('urgentOffensive', 15);
          break;
        case 'level':
          // Level events noted but no boost (Riot compliance: no power spike notifications)
          break;
        case 'matchStart':
        case 'match_start':
          this._state.matchActive = true;
          break;
        case 'matchEnd':
        case 'match_end':
          this._state.matchActive = false;
          break;
      }

      // Announcer events (may come as info updates or events)
      const data = typeof event.data === 'string' ? event.data.toLowerCase() : '';
      if (data.includes('dragon') && (data.includes('kill') || data.includes('slain'))) {
        this._state.lastDragonKillTime = this._state.gameTime;
        this.addBoost('objectiveJustTaken', 15);
      }
      if (data.includes('baron') && (data.includes('kill') || data.includes('slain'))) {
        this._state.lastBaronKillTime = this._state.gameTime;
        this.addBoost('objectiveJustTaken', 15);
      }
      if (data.includes('herald') && (data.includes('kill') || data.includes('slain'))) {
        this._state.lastHeraldKillTime = this._state.gameTime;
        this.addBoost('objectiveJustTaken', 15);
      }
      if (data.includes('turret') && (data.includes('destroy') || data.includes('killed'))) {
        this.addBoost('turretDown', 30);
      }
    }

    // Prune expired boosts
    this.pruneBoosts();

    // Notify listener
    if (this._callback) {
      this._callback(this._state);
    }
  }

  private addBoost(signal: string, durationSeconds: number): void {
    this._state.activeBoosts.push({
      signal,
      expiresAt: this._state.gameTime + durationSeconds
    });
  }

  private pruneBoosts(): void {
    this._state.activeBoosts = this._state.activeBoosts.filter(
      b => b.expiresAt > this._state.gameTime
    );
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
