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
import { GameSummaryCollector } from "../features/game-summary";
import { RiotAPI } from "../features/riot-api";

import WindowState = overwolf.windows.WindowStateEx;

class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _gameState: GameStateManager;
  private _overlay: MinimapOverlay;
  private _minimapConfig: MinimapConfigManager;
  private _calibrationUI: CalibrationUI | null = null;
  private _liveClient: LiveClientPoller;
  private _summaryCollector: GameSummaryCollector;
  private _interactive: boolean = false;
  private _gameEnded: boolean = false;
  private _summonerSaved: boolean = false;
  private _wardsVisible: boolean = false;
  private _wardsHideTimer: number | null = null;
  private _mappingMode: boolean = false;
  private _mappedPoints: { x: number; y: number; nx: number; ny: number }[] = [];

  private constructor() {
    super(kWindowNames.inGame);

    this._minimapConfig = new MinimapConfigManager();
    this._gameState = new GameStateManager();
    this._overlay = new MinimapOverlay(this._minimapConfig);
    this._summaryCollector = new GameSummaryCollector();

    // Live Client Data poller — feeds into game state manager + summary collector
    const riotApi = new RiotAPI();
    this._liveClient = new LiveClientPoller((data) => {
      this._gameState.updateFromLiveClient(data);

      // Save summoner info for Riot API lookups (once per game)
      if (data.allPlayers && !this._summonerSaved) {
        const activeChamp = data.activePlayer?.championName || '';
        const player = data.allPlayers.find((p: any) => p.championName === activeChamp);
        if (player) {
          const gameName = player.riotIdGameName || player.summonerName || '';
          const tagLine = player.riotIdTagLine || '';
          if (gameName) {
            riotApi.saveSummonerInfo(gameName, tagLine);
            this._summonerSaved = true;
          }
        }
      }
    });

    const overlayContainer = document.getElementById('overlayContainer');
    if (overlayContainer) {
      this._overlay.init(overlayContainer);
      this._calibrationUI = new CalibrationUI(this._minimapConfig, overlayContainer);
    }

    // Wire game state changes
    this._gameState.onGameStateChanged((state) => {
      // Update overlay if visible
      if (this._wardsVisible) {
        const spots = getWardSuggestions(state);
        this._overlay.update(spots);
      }

      // Feed summary collector
      this._summaryCollector.update(state);
    });

    // Wire calibrate button
    const calibrateBtn = document.getElementById('calibrateButton');
    if (calibrateBtn) {
      calibrateBtn.addEventListener('click', () => {
        this.startCalibration();
      });
    }

    // Wire reset calibration button
    const resetBtn = document.getElementById('resetCalibrationButton');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._minimapConfig.resetToAuto();
        this._overlay.repositionAll();
      });
    }

    // Wire map wards tool
    this.initMapWardsTool();

    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
    this.listenForResolutionChanges();

    // Start in pass-through mode after everything is wired
    this.updateHeaderVisibility();
    this.initClickthrough();

    // Save game summary when window closes (game ended = background closes this window)
    window.addEventListener('beforeunload', () => {
      if (this._summaryCollector.isCollecting() && !this._gameEnded) {
        this.onGameEnd();
      }
    });
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

    // Show first-game hint if needed
    this.showFirstGameHint();

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

    // Start collecting game summary data
    this._summaryCollector.startCollecting();

    // Wards hidden by default — user toggles with hotkey (compliance: no persistent overlay)
  }

  private onGameEnd(): void {
    this._gameEnded = true;
    this._summaryCollector.stopCollecting();

    const state = this._gameState.getState();
    const summary = this._summaryCollector.buildSummary(state);
    this._summaryCollector.saveSummary(summary);

    // Hide overlay
    this._overlay.hide();
    this._wardsVisible = false;

    // Stop poller
    this._liveClient.stop();
  }

  private async fillGameScreen(): Promise<void> {
    try {
      const gameInfo = await OWGames.getRunningGameInfo();
      if (gameInfo && gameInfo.width && gameInfo.height) {

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
    if (e && e.events && Array.isArray(e.events)) {
      this._gameState.handleGepEvent(e.events);
    }
  }

  private initMapWardsTool(): void {
    const mapBtn = document.getElementById('mapWardsButton');
    const exportBtn = document.getElementById('exportWardsButton');
    const clearBtn = document.getElementById('clearWardsButton');
    const stopBtn = document.getElementById('stopMappingButton');
    const container = document.getElementById('overlayContainer');

    if (mapBtn) {
      mapBtn.addEventListener('click', () => {
        this._mappingMode = true;
        this._mappedPoints = [];
        if (exportBtn) exportBtn.style.display = 'inline-block';
        if (clearBtn) clearBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'inline-block';
        if (mapBtn) mapBtn.style.display = 'none';

        // Disable clickthrough for clicking
        this.setClickthrough(false);

        // Add click listener on the overlay area
        if (container) {
          container.style.pointerEvents = 'auto';
          container.addEventListener('click', this.onMapClick.bind(this));
        }

        console.log('Map Wards mode started — click on minimap to place points');
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stopMapping();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._mappedPoints = [];
        // Remove all mapping dots
        const dots = document.querySelectorAll('.mapping-dot');
        dots.forEach(d => d.remove());
        console.log('Mapped points cleared');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const output = this._mappedPoints.map((p, i) =>
          `  { x: ${p.nx.toFixed(3)}, y: ${p.ny.toFixed(3)} }, // Point ${i + 1} (game: ${p.x}, ${p.y})`
        ).join('\n');

        console.log(`\n===== MAPPED WARD POSITIONS (${this._mappedPoints.length} points) =====`);
        console.log(output);
        console.log('===== END =====\n');

        // Also copy to clipboard if available
        try {
          const text = JSON.stringify(this._mappedPoints.map(p => ({
            nx: parseFloat(p.nx.toFixed(3)),
            ny: parseFloat(p.ny.toFixed(3)),
            gx: p.x,
            gy: p.y
          })), null, 2);
          navigator.clipboard.writeText(text).then(() => {
            console.log('Copied to clipboard!');
          });
        } catch (e) {
          // Clipboard not available
        }
      });
    }
  }

  private onMapClick(e: MouseEvent): void {
    if (!this._mappingMode) return;

    const bounds = this._minimapConfig.getMinimapBounds();
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Check if click is within minimap bounds
    if (clickX < bounds.x || clickX > bounds.x + bounds.width ||
        clickY < bounds.y || clickY > bounds.y + bounds.height) {
      return; // Click outside minimap — ignore
    }

    // Convert to normalized coordinates
    const nx = (clickX - bounds.x) / bounds.width;
    const ny = (clickY - bounds.y) / bounds.height;

    // Convert to game coordinates for reference
    const gx = Math.round(nx * 14990 - 120);
    const gy = Math.round((1 - ny) * 15100 - 120);

    const point = { x: gx, y: gy, nx, ny };
    this._mappedPoints.push(point);

    // Place a visible dot
    const dot = document.createElement('div');
    dot.className = 'mapping-dot';
    dot.style.left = `${clickX}px`;
    dot.style.top = `${clickY}px`;
    dot.textContent = String(this._mappedPoints.length);
    document.getElementById('overlayContainer')?.appendChild(dot);

    console.log(`Point ${this._mappedPoints.length}: minimap(${nx.toFixed(3)}, ${ny.toFixed(3)}) game(${gx}, ${gy})`);
  }

  private stopMapping(): void {
    this._mappingMode = false;

    const mapBtn = document.getElementById('mapWardsButton');
    const exportBtn = document.getElementById('exportWardsButton');
    const clearBtn = document.getElementById('clearWardsButton');
    const stopBtn = document.getElementById('stopMappingButton');
    const container = document.getElementById('overlayContainer');

    if (mapBtn) mapBtn.style.display = 'inline-block';
    if (exportBtn) exportBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';

    if (container) {
      container.style.pointerEvents = 'none';
    }

    // Remove mapping dots
    const dots = document.querySelectorAll('.mapping-dot');
    dots.forEach(d => d.remove());

    console.log(`Mapping stopped. ${this._mappedPoints.length} points recorded.`);
  }

  private showFirstGameHint(): void {
    const HINT_KEY = 'ward_optimizer_hint_shown';
    if (localStorage.getItem(HINT_KEY)) return;

    const hint = document.getElementById('firstGameHint');
    if (hint) {
      hint.style.display = 'block';

      // Auto-hide after 8 seconds (CSS animation handles fade-out at 7s)
      setTimeout(() => {
        hint.style.display = 'none';
        localStorage.setItem(HINT_KEY, '1');
      }, 8000);
    }
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

  private _lastHotkeyTime: number = 0;
  private static DOUBLE_TAP_MS = 400;
  private static WARD_DISPLAY_DURATION = 5000;

  private async setToggleHotkeyBehavior() {
    const onHotkey = async (
      hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent
    ): Promise<void> => {
      const now = Date.now();
      const timeSinceLast = now - this._lastHotkeyTime;
      this._lastHotkeyTime = now;

      if (timeSinceLast < InGame.DOUBLE_TAP_MS) {
        // Double-tap: toggle interactive mode (header visible, clickthrough off)
        this._interactive = !this._interactive;
        this.setClickthrough(!this._interactive);
        this.updateHeaderVisibility();

        // If entering interactive mode, also show wards
        if (this._interactive) {
          this.showWardsTemporarily();
        }
      } else {
        // Single tap: show ward suggestions for 5 seconds then auto-hide
        this.showWardsTemporarily();
      }
    }

    OWHotkeys.onHotkeyDown(kHotkeys.toggle, onHotkey);
  }

  private showWardsTemporarily(): void {
    // Always fetch fresh wards and show
    const state = this._gameState.getState();
    const spots = getWardSuggestions(state);
    this._overlay.show(spots);
    this._wardsVisible = true;

    // Clear any existing hide timer
    if (this._wardsHideTimer !== null) {
      window.clearTimeout(this._wardsHideTimer);
      this._wardsHideTimer = null;
    }

    // Auto-hide after 5 seconds (always, unless in interactive mode)
    if (!this._interactive) {
      this._wardsHideTimer = window.setTimeout(() => {
        this._overlay.hide();
        this._wardsVisible = false;
        this._wardsHideTimer = null;
      }, InGame.WARD_DISPLAY_DURATION);
    }
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
        });
      } else {
        overwolf.windows.removeWindowStyle(this._windowId, overwolf.windows.enums.WindowStyle.InputPassThrough, (res) => {
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
