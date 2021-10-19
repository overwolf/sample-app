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
          reject(result);
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
    await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.restore(name, result => {
        if (result.success) {
          resolve();
        } else {
          reject(result);
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
    await WindowsService.obtainWindow(name);

    return new Promise((resolve, reject) => {
      overwolf.windows.minimize(name, result => {
        if (result.success) {
          resolve();
        } else {
          reject(result);
        }
      });
    });
  }

  /**
   * Close a window
   * @param name
   * @returns {Promise<any>}
   */
  static close(name) {
    return new Promise((resolve, reject) => {
      overwolf.windows.close(name, result => {
        if (result.success) {
          resolve();
        } else {
          reject(result);
        }
      });
    });
  }

  /**
   * Get state of the window
   * @returns {Promise<string>}
   */
  static getWindowState(name) {
    return new Promise((resolve, reject) => {
      overwolf.windows.getWindowState(name, state => {
        if (state.success) {
          resolve(state.window_state_ex);
        } else {
          reject(state);
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
