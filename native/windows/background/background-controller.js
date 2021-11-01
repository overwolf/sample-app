import { kWindowNames } from '../../scripts/constants/window-names.js';
import { RunningGameService } from '../../scripts/services/running-game-service.js';
import { WindowsService } from '../../scripts/services/windows-service.js';
import { HotkeysService } from '../../scripts/services/hotkeys-service.js';
import { GepService } from '../../scripts/services/gep-service.js';
import { EventBus } from '../../scripts/services/event-bus.js';
import { kGameClassIds, kGamesFeatures } from '../../scripts/constants/games-features.js';
import { kHotkeyToggle } from '../../scripts/constants/hotkeys-ids.js';

export class BackgroundController {
  constructor() {
    this.windowsService = WindowsService;
    this.gepService = GepService;
    this.runningGameService = new RunningGameService();
    this.hotkeysService = new HotkeysService();
    this.owEventBus = new EventBus();
  }

  async run() {
    // this will be available when calling overwolf.windows.getMainWindow()
    window.owEventBus = this.owEventBus;
    window.minimize = () => this.minimize();

    // Register handlers to hotkey events
    this._registerHotkeys();

    await this._restoreLaunchWindow();

    // Switch between desktop/in-game windows when launching/closing game
    this.runningGameService.addGameRunningChangedListener(
      isRunning => this._onRunningGameChanged(isRunning)
    );

    overwolf.extensions.onAppLaunchTriggered.addListener(e => {
      if (e && e.source !== 'gamelaunchevent') {
        this._restoreAppWindow();
      }
    });

    // Listen to changes in windows
    overwolf.windows.onStateChanged.addListener(
      () => this._onWindowStateChanged()
    );
  }

  /**
   * Minimize all UI windows
   * @public
   */
  async minimize() {
    const windowsStates = await this.windowsService.getWindowsStates();

    if (!windowsStates.success)
      return;

    const states = windowsStates.resultV2;

    const promises = [];

    if (states[kWindowNames.DESKTOP] !== 'closed') {
      promises.push(this.windowsService.minimize(kWindowNames.DESKTOP));
    }

    if (states[kWindowNames.IN_GAME] !== 'closed') {
      promises.push(this.windowsService.minimize(kWindowNames.IN_GAME));
    }

    if (promises.length) {
      await Promise.all(promises);
    }
  }

  /**
   * Handle game opening/closing
   * @private
   */
  async _onRunningGameChanged(isGameRunning) {
    if (!isGameRunning) {
      // Open desktop window
      this.windowsService.restore(kWindowNames.DESKTOP);
      // Close in-game window
      this.windowsService.close(kWindowNames.IN_GAME);
      return;
    }

    const gameInfo = await this.runningGameService.getRunningGameInfo();

    if (
      !gameInfo ||
      !gameInfo.isRunning ||
      !gameInfo.classId ||
      !kGameClassIds.includes(gameInfo.classId)
    ) {
      return;
    }

    const gameFeatures = kGamesFeatures.get(gameInfo.classId);

    if (gameFeatures && gameFeatures.length) {
      // Register to game events
      this.gepService.setRequiredFeatures(
        gameFeatures,
        e => this._onGameEvents(e),
        e => this._onInfoUpdate(e)
      );
    }

    // Open in-game window
    this.windowsService.restore(kWindowNames.IN_GAME);
    // Close desktop window
    this.windowsService.close(kWindowNames.DESKTOP);
  }

  /**
   * Open the relevant window on app launch
   * @private
   */
  async _restoreLaunchWindow() {
    const gameInfo = await this.runningGameService.getRunningGameInfo();

    if (!gameInfo || !gameInfo.isRunning) {
      await this.windowsService.restore(kWindowNames.DESKTOP);
      return;
    }

    const gameClassId = gameInfo.classId;

    if (!kGameClassIds.includes(gameClassId)) {
      return;
    }

    const gameFeatures = kGamesFeatures.get(gameClassId);

    if (gameFeatures && gameFeatures.length) {
      this.gepService.setRequiredFeatures(
        gameFeatures,
        e => this._onGameEvents(e),
        e => this._onInfoUpdate(e)
      );
    }

    await this.windowsService.restore(kWindowNames.IN_GAME);

    if (BackgroundController._launchedWithGameEvent()) {
      await this.windowsService.minimize(kWindowNames.IN_GAME);
    }
  }

  /**
   * Open the relevant window on user request
   * @private
   */
  async _restoreAppWindow() {
    const isGameRunning = await this.runningGameService.isGameRunning();

    if (isGameRunning) {
      this.windowsService.restore(kWindowNames.IN_GAME);
    } else {
      this.windowsService.restore(kWindowNames.DESKTOP);
    }
  }

  /**
   * App was launched with game launch
   * @private
   */
  static _launchedWithGameEvent() {
    return location.href.includes('source=gamelaunchevent');
  }

  /**
   * Listen to window state changes,
   * close the app when all UI windows are closed
   * @private
   */
  async _onWindowStateChanged() {
    const windowsStates = await this.windowsService.getWindowsStates();

    if (!windowsStates.success)
      return;

    // If all UI (non-background) windows are closed, close the app
    const shouldClose = Object.entries(windowsStates.resultV2)
      .filter(([windowName, windowState]) => (windowName !== 'background'))
      .every(([windowName, windowState]) => (windowState === 'closed'));

    if (shouldClose) {
      window.close();
    }
  }

  /**
   * set custom hotkey behavior
   * @private
   */
  _registerHotkeys() {
    this.hotkeysService.setToggleHotkeyListener(kHotkeyToggle, async () => {
      const state = await this.windowsService.getWindowState(
        kWindowNames.IN_GAME
      );

      if (state === 'minimized' || state === 'closed') {
        this.windowsService.restore(kWindowNames.IN_GAME);
      } else if (state === 'normal' || state === 'maximized') {
        this.windowsService.minimize(kWindowNames.IN_GAME);
      }
    });
  }

  /**
   * Pass events to windows that are listening to them
   * @private
   */
  _onGameEvents(data) {
    data.events.forEach(event => {
      console.log(JSON.stringify(event));
      this.owEventBus.trigger("event", event);

      if (event.name === "matchStart") {
        this.windowsService.restore(kWindowNames.IN_GAME);
      }
    });
  }

  /**
   * Pass info updates to windows that are listening to them
   * @private
   */
  _onInfoUpdate(data) {
    this.owEventBus.trigger("info", data);
  }
}
