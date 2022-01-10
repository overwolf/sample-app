/**
 * Detect whether a game is currently running
 */
export class RunningGameService {
  constructor() {
    this._gameRunningChangedListeners = [];

    this._onGameInfoUpdatedBound = this._onGameInfoUpdated.bind(this);

    overwolf.games.onGameInfoUpdated.removeListener(this._onGameInfoUpdatedBound);
    overwolf.games.onGameInfoUpdated.addListener(this._onGameInfoUpdatedBound);
  }

  /**
   * A game info was updated (running state, or other state changed such as
   * resolution changed)
   * @param event
   * @private
   */
   _onGameInfoUpdated(event) {
    if (
      event &&
      (event.runningChanged || event.gameChanged)
    ) {
      const isRunning = (event.gameInfo && event.gameInfo.isRunning);

      for (let listener of this._gameRunningChangedListeners) {
        listener(isRunning);
      }
    }
  }

  /**
   * Check whether a game is running
   * @returns {Promise<boolean>}
   */
  isGameRunning() {
    return new Promise(resolve => {
      // get the current running game info if any game is running
      overwolf.games.getRunningGameInfo(runningGameInfo => {
        resolve(runningGameInfo && runningGameInfo.isRunning);
      });
    });
  }

  getRunningGameInfo() {
    return new Promise(resolve => {
      // get the current running game info if any game is running
      overwolf.games.getRunningGameInfo(resolve);
    });
  }

  addGameRunningChangedListener(callback) {
    this._gameRunningChangedListeners.push(callback);
  }
}
