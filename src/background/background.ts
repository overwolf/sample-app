import {
  OWGames,
  OWGameListener,
  OWWindow
} from '@overwolf/overwolf-api-ts';

import { kWindowNames, kGameClassIds } from "../consts";

import RunningGameInfo = overwolf.games.RunningGameInfo;
import AppLaunchTriggeredEvent = overwolf.extensions.AppLaunchTriggeredEvent;

class BackgroundController {
  private static _instance: BackgroundController;
  private _windows: Record<string, OWWindow> = {};
  private _gameListener: OWGameListener;

  private constructor() {
    this._windows[kWindowNames.desktop] = new OWWindow(kWindowNames.desktop);
    this._windows[kWindowNames.inGame] = new OWWindow(kWindowNames.inGame);
    this._windows['second_screen'] = new OWWindow('second_screen');

    this._gameListener = new OWGameListener({
      onGameStarted: this.toggleWindows.bind(this),
      onGameEnded: this.toggleWindows.bind(this)
    });

    overwolf.extensions.onAppLaunchTriggered.addListener(
      e => this.onAppLaunchTriggered(e)
    );
  }

  public static instance(): BackgroundController {
    if (!BackgroundController._instance) {
      BackgroundController._instance = new BackgroundController();
    }

    return BackgroundController._instance;
  }

  public async run() {
    this._gameListener.start();

    const currWindowName = (await this.isSupportedGameRunning())
      ? kWindowNames.inGame
      : kWindowNames.desktop;

    this._windows[currWindowName].restore();
  }

  private async onAppLaunchTriggered(e: AppLaunchTriggeredEvent) {
    if (!e || e.origin.includes('gamelaunchevent')) {
      return;
    }

    if (await this.isSupportedGameRunning()) {
      this._windows[kWindowNames.desktop].close();
      this._windows[kWindowNames.inGame].restore();
      this.openSecondScreen();
    } else {
      this._windows[kWindowNames.desktop].restore();
      this._windows[kWindowNames.inGame].close();
    }
  }

  private toggleWindows(info: RunningGameInfo) {
    if (!info || !this.isSupportedGame(info)) {
      return;
    }

    if (info.isRunning) {
      this._windows[kWindowNames.desktop].close();
      this._windows[kWindowNames.inGame].restore();
      this.openSecondScreen();
    } else {
      this._windows[kWindowNames.desktop].restore();
      this._windows[kWindowNames.inGame].close();
      this._windows['second_screen'].close();
    }
  }

  private openSecondScreen(): void {
    // Check if there's a second monitor available
    overwolf.utils.getMonitorsList((result) => {
      if (!result || !result.displays || result.displays.length < 2) {
        return; // No second monitor
      }

      // Find a non-primary monitor
      const primary = result.displays.find((d: any) => d.is_primary);
      const secondary = result.displays.find((d: any) => !d.is_primary);

      if (!secondary) return;

      // Open the second screen window
      this._windows['second_screen'].restore();

      // Position it on the secondary monitor
      overwolf.windows.obtainDeclaredWindow('second_screen', (windowResult) => {
        if (!windowResult || !windowResult.window) return;
        const winId = windowResult.window.id;

        // Position at center of secondary monitor
        const x = secondary.x + Math.round((secondary.width - 400) / 2);
        const y = secondary.y + Math.round((secondary.height - 600) / 2);

        overwolf.windows.changePosition(winId, x, y, () => {});
      });
    });
  }

  private async isSupportedGameRunning(): Promise<boolean> {
    const info = await OWGames.getRunningGameInfo();
    return info && info.isRunning && this.isSupportedGame(info);
  }

  private isSupportedGame(info: RunningGameInfo) {
    return kGameClassIds.includes(info.classId);
  }
}

BackgroundController.instance().run();
