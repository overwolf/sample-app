import { InGameView } from '../../windows/in-game/in-game-view.js';
import { HotkeysService } from '../../scripts/services/hotkeys-service.js';
import { RunningGameService } from '../../scripts/services/running-game-service.js';
import { kHotkeyToggle } from '../../scripts/constants/hotkeys-ids.js';

export class InGameController {
  constructor() {
    this.inGameView = new InGameView();
    this.hotkeysService = new HotkeysService();
    this.runningGameService = new RunningGameService();
    this._eventListenerBound = this._eventListener.bind(this);
  }

  run() {
    // listen to events from the event bus from the main window,
    // the callback will be run in the context of the current window
    const { owEventBus } = overwolf.windows.getMainWindow();

    owEventBus.addListener(this._eventListenerBound);

    // Update hotkey view and listen to changes:
    this._updateHotkey();
    this.hotkeysService.addHotkeyChangeListener(() => this._updateHotkey());
  }

  async _updateHotkey() {
    const gameInfo = await this.runningGameService.getRunningGameInfo();

    const hotkey = await this.hotkeysService.getHotkey(
      kHotkeyToggle,
      gameInfo.classId
    );

    this.inGameView.updateHotkey(hotkey);
  }

  _eventListener(eventName, eventValue) {
    switch (eventName) {
      case 'event': {
        this._gameEventHandler(eventValue);
        break;
      }
      case 'info': {
        this._infoUpdateHandler(eventValue);
        break;
      }
    }
  }

  // Logs events
  _gameEventHandler(event) {
    let isHighlight = false;

    switch (event.name) {
      case 'kill':
      case 'death':
      case 'assist':
      case 'level':
      case 'matchStart':
      case 'matchEnd':
      case 'match_start':
      case 'match_end':
        isHighlight = true;
        break;
    }

    this.inGameView.logEvent(JSON.stringify(event), isHighlight);
  }

  // Logs info updates
  _infoUpdateHandler(infoUpdate) {
    this.inGameView.logInfoUpdate(JSON.stringify(infoUpdate), false);
  }
}
