export class WindowsService {
  /**
   * Obtain a window object by a name as declared in the manifest.
   * This is required in order to create the window before calling other APIs
   * on that window
   * @param name
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
   * Restore a window by name
   * @param name
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
   * @param name
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
   * Close a window
   * @param name
   * @returns {Promise<any>}
   */
  static async close(name) {
    const { window } = await WindowsService.obtainWindow(name);

    if (window.stateEx === 'closed') {
      return;
    }

    return new Promise((resolve, reject) => {
      overwolf.windows.close(window.id, result => {
        if (result.success) {
          resolve();
        } else {
          console.warn('WindowsService.close(): error:', name, result);
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Get state of the window
   * @returns {Promise<string>}
   */
  static async getWindowState(name) {
    const { window } = await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.getWindowState(window.id, result => {
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
   * Get states of app's windows
   * @returns {Promise<any>}
   */
   static getWindowsStates() {
    return new Promise((resolve, reject) => {
      overwolf.windows.getWindowsStates(state => {
        if (state.success) {
          resolve(state);
        } else {
          reject(state);
        }
      })
    });
  }
}
