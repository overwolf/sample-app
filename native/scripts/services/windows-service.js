export class WindowsService {
  /**
   * Obtain a window object by a name as declared in the manifest.
   * This is required in order to create the window before calling other APIs
   * on that window
   * @param {string} name
   * @returns {Promise<any>}
   */
  static obtainWindow(name) {
    return new Promise((resolve, reject) => {
      overwolf.windows.obtainDeclaredWindow(name, result => {
        if (result.success) {
          resolve(result);
        } else {
          console.warn('WindowsService.obtainWindow(): error:', name, result);
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Obtain the current window's object. This is required in order to create
   * the window before calling other APIs on that window
   * @returns {Promise<any>}
   */
  static getCurrentWindow() {
    return new Promise((resolve, reject) => {
      overwolf.windows.getCurrentWindow(result => {
        if (result.success) {
          resolve(result);
        } else {
          console.warn(
            'WindowsService.getCurrentWindow(): error:',
            result
          );
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Restore a window by name
   * @param {string} name
   * @returns {Promise<any>}
   */
  static async restore(name) {
    const { window } = await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.restore(window.id, result => {
        if (result.success) {
          resolve();
        } else {
          console.warn('WindowsService.restore(): error:', name, result);
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Minimize a window by name
   * @param {string} name
   * @returns {Promise<any>}
   */
  static async minimize(name) {
    const { window } = await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.minimize(window.id, result => {
        if (result.success) {
          resolve();
        } else {
          console.warn('WindowsService.minimize(): error:', name, result);
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Maximize a window by name
   * @param {string} name
   * @returns {Promise<any>}
   */
  static async maximize(name) {
    const { window } = await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.maximize(window.id, result => {
        if (result.success) {
          resolve();
        } else {
          console.warn('WindowsService.maximize(): error:', name, result);
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Close a window
   * @param {string} name
   * @returns {Promise<void>}
   */
  static async close(name) {
    const state = await WindowsService.getWindowState(name);

    if (state === 'closed')
      return;

    const { window } = await WindowsService.obtainWindow(name);

    await new Promise(resolve => overwolf.windows.close(window.id, resolve));
  }

  /**
   * Set position of a window
   * @param {string} name
   * @param {number} left
   * @param {number} top
   * @returns {Promise<any>}
   */
  static async changePosition(name, left, top) {
    const { window } = await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.changePosition(window.id, left, top, result => {
        if (result && result.success) {
          resolve(result);
        } else {
          console.warn('WindowsService.changePosition(): error:', name, result);
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Get state of the window
   * @param {string} name
   * @returns {Promise<string>}
   */
  static getWindowState(name) {
    return new Promise((resolve, reject) => {
      overwolf.windows.getWindowState(name, result => {
        if (result.success) {
          resolve(result.window_state_ex);
        } else {
          console.warn('WindowsService.getWindowState(): error:', name, result);
          reject(new Error(result.error));
        }
      })
    });
  }

  /**
   * Get state of the window
   * @param {string} name
   * @param {boolean} shouldBeTopmost
   * @returns {Promise<any>}
   */
  static async setTopmost(name, shouldBeTopmost) {
    const { window } = await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.setTopmost(window.id, shouldBeTopmost, result => {
        if (result.success) {
          resolve(result);
        } else {
          console.warn('WindowsService.setTopmost(): error:', name, result);
          reject(new Error(result.error));
        }
      })
    });
  }

  /**
   * Get state of the window
   * @param {string} name
   * @param {boolean} grabFocus
   * @returns {Promise<any>}
   */
  static async bringToFront(name, grabFocus = false) {
    const { window } = await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.bringToFront(window.id, grabFocus, result => {
        if (result.success) {
          resolve(result);
        } else {
          console.warn('WindowsService.bringToFront(): error:', name, result);
          reject(new Error(result.error));
        }
      })
    });
  }

  /**
   * Get states of app's windows
   * @returns {Promise<any>}
   */
   static getWindowsStates() {
    return new Promise((resolve, reject) => {
      overwolf.windows.getWindowsStates(state => {
        if (state.success) {
          resolve(state.resultV2);
        } else {
          reject(state);
        }
      })
    });
  }

  /**
   * Get a list of monitors
   * @returns {Promise<any[]>}
   */
  static getMonitorsList() {
    return new Promise((resolve, reject) => {
      overwolf.utils.getMonitorsList(result => {
        if (result && result.success && result.displays) {
          resolve(result.displays);
        } else {
          console.warn('WindowsService.getMonitorsList(): error:', result);
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Determine if a window stat is open (normal or maximized)
   * @returns {Boolean}
   */
  static windowStateIsOpen(state) {
    switch (state) {
      case 'normal':
      case 'maximized':
        return true;
      default:
        return false;
    }
  }
}
