import { AppWindow } from "../AppWindow";
import { kWindowNames } from "../consts";
import { MinimapConfigManager } from "../features/minimap-config";
import { GameSummaryCollector } from "../features/game-summary";
import { RiotAPI } from "../features/riot-api";
import { GameSummary } from "../types";

const TIPS = [
  "Ward river brushes before objectives spawn",
  "Place control wards in your own jungle when behind",
  "Deep wards in enemy jungle reveal their jungler's pathing",
  "Supports should aim for 1.5+ ward score per minute",
  "Switch to Farsight Alteration after laning phase as a carry",
  "Ward Baron 60 seconds before it spawns",
  "Always have a control ward in your inventory",
  "Ward the pixel brush in mid river to track roams",
  "Place defensive wards when your team is behind in gold",
  "Clearing enemy wards is just as important as placing your own",
];

const LEAGUE_CLASS_ID = 5426;
const LEAGUE_LAUNCHER_ID = 10902;
const STATUS_INTERVAL = 5000;
const TIP_INTERVAL = 10000;
const DATA_POLL_INTERVAL = 2000;

class Desktop extends AppWindow {
  private _minimapConfig: MinimapConfigManager;
  private _currentTip: number = 0;
  private _riotApi: RiotAPI;
  private _activeTab: string = 'home';
  private _lastGameTimestamp: number = 0;

  constructor() {
    super(kWindowNames.desktop);

    this._minimapConfig = new MinimapConfigManager();
    this._riotApi = new RiotAPI();
    // Set Riot API key via localStorage: ward_optimizer_riot_api_key
    this.initSettingsPanel();
    this.initStatusCheck();
    this.initTips();
    this.initTabs();
    this.initDataPolling();
    this.initWelcome();
    this.initAds();
  }

  // ===== TABS =====

  private initTabs(): void {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        if (tabName) this.switchTab(tabName);
      });
    });
  }

  private switchTab(tabName: string): void {
    this._activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('tab-active', (btn as HTMLElement).dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('tab-visible', content.id === `tab-${tabName}`);
    });

    // Render content when switching
    if (tabName === 'lastgame') this.renderLastGame();
    if (tabName === 'history') this.renderHistory();
  }

  // ===== DATA POLLING =====

  private _fetchingRiotData: boolean = false;
  private _wasInGame: boolean = false;

  private initDataPolling(): void {
    setInterval(async () => {
      // Check if game just ended (was in game, now not)
      const inGame = await this.isLeagueGameRunning();
      if (this._wasInGame && !inGame && !this._fetchingRiotData) {
        this._wasInGame = false;
        this._fetchingRiotData = true;

        // Wait 30s for Riot API to have the match data
        setTimeout(() => this.fetchRiotGameData(), 30000);
      }
      if (inGame) {
        this._wasInGame = true;
      }

      // Also check localStorage for in-game collected data
      const lastGame = GameSummaryCollector.getLastGame();
      if (lastGame && lastGame.timestamp !== this._lastGameTimestamp) {
        this._lastGameTimestamp = lastGame.timestamp;
        this.switchTab('lastgame');
      }
    }, DATA_POLL_INTERVAL);
  }

  private async fetchRiotGameData(): Promise<void> {
    try {
      if (!this._riotApi.hasApiKey()) {
        this._fetchingRiotData = false;
        return;
      }

      const summary = await this._riotApi.fetchLastGameSummary();
      if (summary) {
        // Generate tips from the API data
        summary.tips = GameSummaryCollector.generateTips(summary);

        // Save to localStorage (overwrites in-game collected data with accurate API data)
        const summaryCollector = new GameSummaryCollector();
        summaryCollector.saveSummary(summary);

        this._lastGameTimestamp = summary.timestamp;
        this.switchTab('lastgame');
      }
    } catch (e) {}
    this._fetchingRiotData = false;
  }


  // ===== LAST GAME VIEW =====

  private renderLastGame(): void {
    const container = document.getElementById('lastGameContent');
    if (!container) return;

    const game = GameSummaryCollector.getLastGame();
    if (!game || !game.champion || game.champion === 'Unknown' || game.duration < 60) {
      container.innerHTML = '<p class="no-data-message">No game data yet. Play a match to see your summary!</p>';
      return;
    }

    const duration = game.duration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const kills = game.kills || 0;
    const deaths = game.deaths || 0;
    const assists = game.assists || 0;
    const kda = `${kills}/${deaths}/${assists}`;
    const winClass = game.win ? 'win' : 'loss';
    const winText = game.win ? 'Victory' : 'Defeat';
    const wardScore = (game.wardScore || 0).toFixed(2);
    const teamAvg = game.teamAvgWardScore || 0;

    container.innerHTML = `
      <div class="hex-card summary-card">
        <div class="hex-card-corner hex-card-corner-tl"></div>
        <div class="hex-card-corner hex-card-corner-tr"></div>
        <div class="hex-card-corner hex-card-corner-bl"></div>
        <div class="hex-card-corner hex-card-corner-br"></div>

        <div class="summary-header">
          <div class="summary-champ">${game.champion || 'Unknown'}</div>
          <div class="summary-role">${game.role || 'unknown'}</div>
          <div class="summary-result ${winClass}">${winText}</div>
          <div class="summary-duration">${minutes}:${seconds.toString().padStart(2, '0')}</div>
        </div>

        <div class="summary-stats">
          <div class="stat-box">
            <div class="stat-value">${kda}</div>
            <div class="stat-label">KDA</div>
          </div>
          <div class="stat-box stat-highlight">
            <div class="stat-value">${wardScore}</div>
            <div class="stat-label">Ward Score</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${teamAvg.toFixed(2)}</div>
            <div class="stat-label">Team Avg</div>
          </div>
        </div>

        <div class="summary-timeline">
          <h3>Ward Score Timeline</h3>
          <div class="timeline-chart">
            ${this.renderTimelineChart(game)}
          </div>
        </div>

        <div class="summary-objectives">
          <span class="obj-item">Dragons: ${game.dragonsKilled || 0}</span>
          <span class="obj-item">Enemy Dragons: ${game.enemyDragonsKilled || 0}</span>
          <span class="obj-item">Barons: ${game.baronsKilled || 0}</span>
          <span class="obj-item">Heralds: ${game.heraldsKilled || 0}</span>
          <span class="obj-item">Grubs: ${game.grubsKilled || 0}</span>
        </div>
      </div>

      <div class="hex-card tips-card">
        <div class="hex-card-corner hex-card-corner-tl"></div>
        <div class="hex-card-corner hex-card-corner-tr"></div>
        <div class="hex-card-corner hex-card-corner-bl"></div>
        <div class="hex-card-corner hex-card-corner-br"></div>
        <h2>Game Tips</h2>
        ${(game.tips || []).length > 0 ? (game.tips || []).map(tip => `
          <div class="game-tip ${tip.type || 'improvement'}">
            <span class="tip-badge">${tip.type === 'positive' ? '+' : '!'}</span>
            <span>${tip.text || ''}</span>
          </div>
        `).join('') : '<p class="no-data-message">No tips for this game.</p>'}
      </div>
    `;
  }

  private renderTimelineChart(game: GameSummary): string {
    if (!game.wardScoreTimeline || game.wardScoreTimeline.length === 0) {
      return '<p class="no-data-message">No timeline data</p>';
    }

    const maxScore = Math.max(...game.wardScoreTimeline.map(p => p.score), 1);
    const bars = game.wardScoreTimeline.map(point => {
      const height = Math.round((point.score / maxScore) * 60);
      const minute = Math.floor(point.time / 60);
      return `<div class="timeline-bar" style="height:${height}px" title="${minute}min: ${point.score.toFixed(2)}"></div>`;
    }).join('');

    return bars;
  }

  // ===== HISTORY VIEW =====

  private renderHistory(): void {
    const container = document.getElementById('historyContent');
    if (!container) return;

    const history = GameSummaryCollector.getHistory().filter(
      g => g.champion && g.champion !== 'Unknown' && g.champion !== '' && (g.duration || 0) >= 60
    );
    if (history.length === 0) {
      container.innerHTML = '<p class="no-data-message">No game history yet. Play some matches to see your trends!</p>';
      return;
    }

    // Trend chart — handle single game and zero scores
    const wardScores = history.map(g => g.wardScore || 0);
    const maxWardScore = Math.max(...wardScores, 1);
    const reversed = history.slice().reverse();
    const chartPoints = reversed.map((g, i) => {
      const x = reversed.length === 1 ? 50 : (i / (reversed.length - 1)) * 100;
      const y = 100 - ((g.wardScore || 0) / maxWardScore * 80);
      return `${x},${y}`;
    }).join(' ');

    // Game list — safe date handling
    const rows = history.map(g => {
      const date = g.timestamp ? new Date(g.timestamp).toLocaleDateString() : 'Unknown';
      const winClass = g.win ? 'win' : 'loss';
      return `
        <div class="history-row">
          <span class="history-champ">${g.champion || '?'}</span>
          <span class="history-role">${g.role || '?'}</span>
          <span class="history-ward-score">${(g.wardScore || 0).toFixed(2)}</span>
          <span class="history-result ${winClass}">${g.win ? 'W' : 'L'}</span>
          <span class="history-date">${date}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="hex-card">
        <div class="hex-card-corner hex-card-corner-tl"></div>
        <div class="hex-card-corner hex-card-corner-tr"></div>
        <div class="hex-card-corner hex-card-corner-bl"></div>
        <div class="hex-card-corner hex-card-corner-br"></div>
        <h2>Ward Score Trend</h2>
        <div class="trend-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="trend-svg">
            <polyline points="${chartPoints}" fill="none" stroke="#C89B3C" stroke-width="2" />
            ${reversed.map((g, i) => {
              const x = reversed.length === 1 ? 50 : (i / (reversed.length - 1)) * 100;
              const y = 100 - ((g.wardScore || 0) / maxWardScore * 80);
              return `<circle cx="${x}" cy="${y}" r="3" fill="#0AC8B9" />`;
            }).join('')}
          </svg>
        </div>
      </div>

      <div class="hex-card">
        <div class="hex-card-corner hex-card-corner-tl"></div>
        <div class="hex-card-corner hex-card-corner-tr"></div>
        <div class="hex-card-corner hex-card-corner-bl"></div>
        <div class="hex-card-corner hex-card-corner-br"></div>
        <h2>Recent Games</h2>
        <div class="history-header">
          <span>Champion</span>
          <span>Role</span>
          <span>Wards</span>
          <span>Result</span>
          <span>Date</span>
        </div>
        ${rows}
      </div>
    `;
  }

  // ===== SETTINGS =====

  private initSettingsPanel(): void {
    const resetAutoBtn = document.getElementById('resetAutoBtn');
    const sideSelect = document.getElementById('sideSelect') as HTMLSelectElement;

    this.updateDisplay();

    if (resetAutoBtn) {
      resetAutoBtn.addEventListener('click', () => {
        this._minimapConfig.resetToAuto();
        this.updateDisplay();
      });
    }

    if (sideSelect) {
      const config = this._minimapConfig.getConfig();
      if (config.sideOverride) {
        sideSelect.value = config.sideOverride;
      }

      sideSelect.addEventListener('change', () => {
        const value = sideSelect.value;
        this._minimapConfig.setSideOverride(value === '' ? null : value as 'left' | 'right');
        this.updateDisplay();
      });
    }
  }

  private updateDisplay(): void {
    const modeDisplay = document.getElementById('modeDisplay');
    if (modeDisplay) {
      modeDisplay.textContent = this._minimapConfig.isManualMode() ? 'Manual (calibrated)' : 'Auto';
    }
  }

  // ===== STATUS =====

  private initStatusCheck(): void {
    this.checkStatus();
    setInterval(() => this.checkStatus(), STATUS_INTERVAL);
  }

  private async checkStatus(): Promise<void> {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const footerMsg = document.getElementById('footerMessage');

    const gameRunning = await this.isLeagueGameRunning();
    const clientRunning = gameRunning || await this.isLeagueClientRunning();

    if (gameRunning) {
      if (indicator) indicator.className = 'status-pill status-connected';
      if (statusText) statusText.textContent = 'In Game';
      if (footerMsg) footerMsg.textContent = 'Ward Optimizer overlay is active';
    } else if (clientRunning) {
      if (indicator) indicator.className = 'status-pill status-connected';
      if (statusText) statusText.textContent = 'Client Open';
      if (footerMsg) footerMsg.textContent = 'Start a game to activate the ward overlay';
    } else {
      if (indicator) indicator.className = 'status-pill status-disconnected';
      if (statusText) statusText.textContent = 'Not Connected';
      if (footerMsg) footerMsg.textContent = 'Launch League of Legends to activate the overlay';
    }
  }

  private isLeagueGameRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        overwolf.games.getRunningGameInfo((info) => {
          resolve(info && info.isRunning && info.classId === LEAGUE_CLASS_ID);
        });
      } catch { resolve(false); }
    });
  }

  private isLeagueClientRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        overwolf.games.launchers.getRunningLaunchersInfo((info) => {
          if (info && info.launchers) {
            resolve(info.launchers.some((l: any) => l.classId === LEAGUE_LAUNCHER_ID));
          } else { resolve(false); }
        });
      } catch { resolve(false); }
    });
  }

  // ===== TIPS =====

  private initTips(): void {
    this.showTip();
    setInterval(() => this.rotateTip(), TIP_INTERVAL);
  }

  private showTip(): void {
    const tipText = document.getElementById('tipText');
    if (tipText) tipText.textContent = TIPS[this._currentTip];
  }

  private rotateTip(): void {
    const tipText = document.getElementById('tipText');
    if (!tipText) return;
    tipText.classList.add('fade-out');
    setTimeout(() => {
      this._currentTip = (this._currentTip + 1) % TIPS.length;
      tipText.textContent = TIPS[this._currentTip];
      tipText.classList.remove('fade-out');
    }, 500);
  }

  // ===== WELCOME (FTUE) =====

  private initWelcome(): void {
    const WELCOME_KEY = 'ward_optimizer_welcomed';
    const welcomed = localStorage.getItem(WELCOME_KEY);

    if (welcomed) return;

    const modal = document.getElementById('welcomeModal');
    const startBtn = document.getElementById('welcomeStartBtn');

    if (modal) {
      modal.style.display = 'flex';
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (modal) {
          modal.style.display = 'none';
        }
        localStorage.setItem(WELCOME_KEY, '1');
      });
    }
  }

  // ===== ADS =====

  private initAds(): void {
    // Wait for ads SDK to load
    const checkAds = setInterval(() => {
      if ((window as any).__adsReady && (window as any).OwAd) {
        clearInterval(checkAds);
        this.createAds();
      }
    }, 500);

    // Stop checking after 15 seconds
    setTimeout(() => clearInterval(checkAds), 15000);
  }

  private createAds(): void {
    const OwAd = (window as any).OwAd;
    if (!OwAd) return;

    // Home tab — 400x60 banner
    const homeAdEl = document.getElementById('ad-home');
    if (homeAdEl) {
      try {
        new OwAd(homeAdEl, {
          size: { width: 400, height: 60 },
          containerId: 'wardoptimizer_400x60_desktop_home'
        });
      } catch (e) {}
    }

    // Last Game tab — 400x60 banner
    const lastGameAdEl = document.getElementById('ad-lastgame');
    if (lastGameAdEl) {
      try {
        new OwAd(lastGameAdEl, {
          size: { width: 400, height: 60 },
          containerId: 'wardoptimizer_400x60_desktop_lastgame'
        });
      } catch (e) {}
    }

    // History tab — 400x60 banner
    const historyAdEl = document.getElementById('ad-history');
    if (historyAdEl) {
      try {
        new OwAd(historyAdEl, {
          size: { width: 400, height: 60 },
          containerId: 'wardoptimizer_400x60_desktop_history'
        });
      } catch (e) {}
    }
  }
}

new Desktop();
