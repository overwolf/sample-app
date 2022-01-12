export class HotkeysService {
	constructor() {
		// List of Toggle hotkeys that we're listening for
		this.toggleHotkeys = {};

		// List of Hold hotkeys that we're listening for
		this.holdHotkeys = {};

		this.init();
	}

	init() {
		/**
		 * Listen to any Toggle hotkey press, and execute any stored custom action
		 */
		overwolf.settings.hotkeys.onPressed.addListener(e => {
			if (e.name in this.toggleHotkeys) {
				const listener = this.toggleHotkeys[e.name];
				listener();
			}
		});

		/**
		 * Listen to any Hold hotkey press, and execute any stored custom action
		 */
		overwolf.settings.hotkeys.onHold.addListener(e => {
			if (e.name in this.holdHotkeys) {
				const listener = this.holdHotkeys[e.name];
				listener(e.state);
			}
		});
	}

	/**
	 * Get a hotkey combination by hotkey id and game id
	 * @param hotkeyId
	 * @param callback
	 * @private
	 */
	_getHotkey(hotkeyId, gameId, callback) {
		overwolf.settings.hotkeys.get(result => {
			if (result && result.success) {
				if (
					result.games &&
					result.games[gameId] &&
					result.games[gameId].length
				) {
					const hotkey = result.games[gameId].find(hotkey => {
						return (hotkey.name === hotkeyId);
					});

					if (hotkey) {
						callback(hotkey.binding);
						return;
					}
				}

				callback(null);
			} else {
				setTimeout(() => this._getHotkey(hotkeyId, gameId, callback), 2000);
			}
		});
	}

	/**
	 * set custom action for a hotkey id (not of HOLD type)
	 * @param hotkeyId
	 * @param action
	 */
	setToggleHotkeyListener(hotkeyId, action) {
		this.toggleHotkeys[hotkeyId] = action;
	}

	/**
	 * set custom action for a HOLD hotkey id
	 * @param hotkeyId
	 * @param action
	 */
	setHoldHotkeyListener(hotkeyId, action) {
		this.holdHotkeys[hotkeyId] = action;
	}

	/**
	 * get a hotkey combination by hotkey id and game id
	 * @param hotkeyId
	 * @param gameId
	 */
	getHotkey(hotkeyId, gameId) {
		return new Promise(resolve => {
			this._getHotkey(hotkeyId, gameId, resolve);
		});
	}

	addHotkeyChangeListener(listener) {
		overwolf.settings.hotkeys.onChanged.addListener(listener);
	}
}
