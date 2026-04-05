import { AppWindow } from "../AppWindow";
import { LiveClientPoller } from "../features/live-client";
import { GameStateManager } from "../features/game-state";
import { getWardSuggestions } from "../features/ward-data";
import { kLeagueFeatures } from "../consts";

const SECOND_SCREEN_NAME = 'second_screen';

class SecondScreen extends AppWindow {
  private _gameState: GameStateManager;
  private _liveClient: LiveClientPoller;

  constructor() {
    super(SECOND_SCREEN_NAME);

    this._gameState = new GameStateManager();
    this._liveClient = new LiveClientPoller((data) => {
      this._gameState.updateFromLiveClient(data);
    });

    this._gameState.onGameStateChanged((state) => {
      this.updateUI(state);
    });

    this.initAds();

    this._liveClient.start();
  }

  private updateUI(state: any): void {
    // Phase
    const phaseEl = document.getElementById('ssPhase');
    if (phaseEl) {
      const phaseText = state.phase === 'early' ? 'Early Game' : state.phase === 'mid' ? 'Mid Game' : 'Late Game';
      phaseEl.textContent = phaseText;
      phaseEl.className = `ss-phase ss-phase-${state.phase}`;
    }

    // Role
    const roleEl = document.getElementById('ssRole');
    if (roleEl) roleEl.textContent = state.activePlayerRole || '-';

    // Side
    const sideEl = document.getElementById('ssSide');
    if (sideEl) {
      sideEl.textContent = state.side === 'blue' ? 'Blue Side' : 'Red Side';
      sideEl.className = `ss-side ss-side-${state.side}`;
    }

    // Timer
    const timerEl = document.getElementById('ssTimer');
    if (timerEl) {
      const mins = Math.floor(state.gameTime / 60);
      const secs = Math.floor(state.gameTime % 60);
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Kills
    const killsEl = document.getElementById('ssKills');
    if (killsEl) killsEl.textContent = String(state.teamKills || 0);

    const deathsEl = document.getElementById('ssDeaths');
    if (deathsEl) deathsEl.textContent = String(state.enemyKills || 0);

    // Gold advantage
    const goldEl = document.getElementById('ssGold');
    if (goldEl) {
      const adv = state.goldAdvantage || 0;
      if (adv > 2000) {
        goldEl.textContent = `+${adv}`;
        goldEl.className = 'ss-stat-value ss-gold ss-ahead';
      } else if (adv < -2000) {
        goldEl.textContent = `${adv}`;
        goldEl.className = 'ss-stat-value ss-gold ss-behind';
      } else {
        goldEl.textContent = 'Even';
        goldEl.className = 'ss-stat-value ss-gold';
      }
    }

    // Objectives
    this.updateObjective('ssDragon', state.dragonAlive, state.dragonsKilled);
    this.updateObjective('ssBaron', state.baronAlive, 0);
    this.updateObjective('ssHerald', state.heraldAlive, state.heraldKilled ? 1 : 0);
    this.updateObjective('ssGrubs', state.grubsAlive, state.grubsKilled);

    // Ward suggestions
    const wardList = document.getElementById('ssWardList');
    if (wardList) {
      const spots = getWardSuggestions(state);
      if (spots.length === 0) {
        wardList.innerHTML = '<p class="ss-muted">No suggestions available</p>';
      } else {
        wardList.innerHTML = spots.map(spot => {
          const typeClass = spot.type === 'defensive' ? 'ss-ward-def' : spot.type === 'offensive' ? 'ss-ward-off' : 'ss-ward-neutral';
          return `<div class="ss-ward-item ${typeClass}">
            <span class="ss-ward-dot"></span>
            <span class="ss-ward-label">${spot.label}</span>
            <span class="ss-ward-score">${spot.score.toFixed(2)}</span>
          </div>`;
        }).join('');
      }
    }
  }

  private updateObjective(id: string, alive: boolean, killed: number): void {
    const el = document.getElementById(id);
    if (!el) return;
    const status = el.querySelector('.ss-obj-status');
    if (status) {
      if (alive) {
        status.textContent = 'Alive';
        el.className = 'ss-obj ss-obj-alive';
      } else if (killed > 0) {
        status.textContent = `Taken (${killed})`;
        el.className = 'ss-obj ss-obj-taken';
      } else {
        status.textContent = 'Not spawned';
        el.className = 'ss-obj';
      }
    }
  }

  private initAds(): void {
    const checkAds = setInterval(() => {
      if ((window as any).__adsReady && (window as any).OwAd) {
        clearInterval(checkAds);
        const OwAd = (window as any).OwAd;
        const adEl = document.getElementById('ad-second-screen');
        if (adEl) {
          try {
            new OwAd(adEl, {
              size: { width: 400, height: 60 },
              containerId: 'wardoptimizer_400x60_secondscreen_bottom'
            });
          } catch (e) {}
        }
      }
    }, 500);
    setTimeout(() => clearInterval(checkAds), 15000);
  }
}

new SecondScreen();
