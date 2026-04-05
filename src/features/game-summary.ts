import { GameState, GameSummary, GameTip, PlayerRole } from '../types';

const HISTORY_KEY = 'ward_optimizer_game_history';
const LAST_GAME_KEY = 'ward_optimizer_last_game';
const MAX_HISTORY = 10;
const SNAPSHOT_INTERVAL = 60; // seconds

export class GameSummaryCollector {
  private _collecting: boolean = false;
  private _wardScoreTimeline: { time: number; score: number }[] = [];
  private _lastSnapshotTime: number = 0;
  private _startWardScore: number = 0;
  private _earlyWardScore: number = 0;
  private _midWardScore: number = 0;

  public startCollecting(): void {
    this._collecting = true;
    this._wardScoreTimeline = [];
    this._lastSnapshotTime = 0;
    this._startWardScore = 0;
    this._earlyWardScore = 0;
    this._midWardScore = 0;
  }

  public stopCollecting(): void {
    this._collecting = false;
  }

  public isCollecting(): boolean {
    return this._collecting;
  }

  /** Call every 3s with current game state to snapshot ward score */
  public update(state: GameState): void {
    if (!this._collecting) return;

    const time = Math.floor(state.gameTime);

    // Snapshot ward score every 60 seconds
    if (time - this._lastSnapshotTime >= SNAPSHOT_INTERVAL) {
      this._wardScoreTimeline.push({ time, score: state.activePlayerWardScore || 0 });
      this._lastSnapshotTime = time;

      // Track phase transitions for ward score breakdown
      if (time <= 14 * 60) {
        this._earlyWardScore = state.activePlayerWardScore || 0;
      } else if (time <= 25 * 60) {
        this._midWardScore = state.activePlayerWardScore || 0;
      }
    }
  }

  /** Build final summary when game ends */
  public buildSummary(state: GameState): GameSummary {
    const duration = Math.floor(state.gameTime);
    const wardScore = state.activePlayerWardScore || 0;

    // Calculate phase ward scores (delta between phases)
    const earlyScore = this._earlyWardScore;
    const midScore = this._midWardScore - this._earlyWardScore;
    const lateScore = wardScore - this._midWardScore;

    // Detect win from recent events
    const gameEndEvent = state.recentEvents.find(e => e.eventName === 'GameEnd');
    const win = gameEndEvent ? (gameEndEvent as any).result === 'Win' : false;

    const summary: GameSummary = {
      matchId: `game_${Date.now()}`,
      champion: state.activePlayerChampion,
      role: state.activePlayerRole,
      side: state.side,
      win,
      duration,
      kills: state.activePlayerKills || 0,
      deaths: state.activePlayerDeaths || 0,
      assists: state.activePlayerAssists || 0,
      wardScore,
      teamAvgWardScore: state.teamAvgWardScore || 0,
      wardScoreTimeline: [...this._wardScoreTimeline],
      dragonsKilled: state.dragonsKilled,
      enemyDragonsKilled: state.enemyDragonsKilled,
      baronsKilled: 0,
      heraldsKilled: state.heraldKilled ? 1 : 0,
      grubsKilled: state.grubsKilled,
      earlyGameWardScore: Math.max(0, earlyScore),
      midGameWardScore: Math.max(0, midScore),
      lateGameWardScore: Math.max(0, lateScore),
      tips: [],
      timestamp: Date.now()
    };

    summary.tips = GameSummaryCollector.generateTips(summary);
    return summary;
  }

  /** Save summary to localStorage */
  public saveSummary(summary: GameSummary): void {
    // Don't save empty/unknown games
    if (!summary.champion || summary.champion === '' || (summary.duration || 0) < 60) {
      return;
    }

    try {
      // Save as last game
      localStorage.setItem(LAST_GAME_KEY, JSON.stringify(summary));

      // Append to history
      const history = this.getHistory();
      history.unshift(summary);
      if (history.length > MAX_HISTORY) {
        history.length = MAX_HISTORY;
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  /** Get game history from localStorage */
  public static getHistory(): GameSummary[] {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // Corrupted data — clear it
      try { localStorage.removeItem(HISTORY_KEY); } catch (e2) {}
    }
    return [];
  }

  /** Get last game from localStorage */
  public static getLastGame(): GameSummary | null {
    try {
      const stored = localStorage.getItem(LAST_GAME_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      try { localStorage.removeItem(LAST_GAME_KEY); } catch (e2) {}
    }
    return null;
  }

  private getHistory(): GameSummary[] {
    return GameSummaryCollector.getHistory();
  }

  public static generateTips(summary: GameSummary): GameTip[] {
    const tips: GameTip[] = [];
    const minutesPlayed = Math.max((summary.duration || 0) / 60, 1); // avoid division by zero

    // Positive tips first
    if (summary.wardScore > minutesPlayed * 1.5) {
      tips.push({ text: 'Excellent ward score for this game length!', type: 'positive' });
    }
    if (summary.teamAvgWardScore > 0 && summary.wardScore > summary.teamAvgWardScore * 1.3) {
      tips.push({ text: 'Great warding! Your vision was above your team\'s average.', type: 'positive' });
    }

    // Improvement tips
    if (summary.teamAvgWardScore > 0 && summary.wardScore < summary.teamAvgWardScore) {
      tips.push({ text: 'Your ward score was below your team\'s average. Try to ward more often.', type: 'improvement' });
    }
    if (summary.earlyGameWardScore < 5) {
      tips.push({ text: 'Low early game vision. Place your trinket ward by 1:30 to spot invades.', type: 'improvement' });
    }
    if (summary.dragonsKilled < summary.enemyDragonsKilled) {
      tips.push({ text: 'Your team lost dragon control. Ward dragon pit 60s before it spawns.', type: 'improvement' });
    }
    if (summary.role === 'support' && (summary.wardScore || 0) < minutesPlayed * 1.5) {
      const actual = ((summary.wardScore || 0) / minutesPlayed).toFixed(2);
      tips.push({ text: `As support, aim for 1.5 ward score per minute. You had ${actual}.`, type: 'improvement' });
    }
    if (summary.duration > 25 * 60 && summary.lateGameWardScore <= 0) {
      tips.push({ text: 'You stopped warding in late game. Late vision around baron is critical.', type: 'improvement' });
    }
    if (summary.duration > 25 * 60 && summary.baronsKilled === 0) {
      tips.push({ text: 'No baron taken. Prioritize baron vision in late game.', type: 'improvement' });
    }

    // Ensure at least one positive tip if they did okay
    if (tips.every(t => t.type === 'improvement') && summary.wardScore > 0) {
      tips.unshift({ text: 'Keep warding! Vision wins games.', type: 'positive' });
    }

    // Return top 3
    return tips.slice(0, 3);
  }
}
