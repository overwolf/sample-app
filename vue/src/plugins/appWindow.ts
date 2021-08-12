import { OWWindow } from "@overwolf/overwolf-api-ts/dist";

export default {
  install(Vue: any) {
    Vue.prototype.$mainWindow = new OWWindow("background");
    let maximized = false;

    Vue.prototype.$closeApp = function() {
      this.$mainWindow.close();
    };
    Vue.prototype.$minimizeApp = function(windowName: string) {
      const window = new OWWindow(windowName);
      window.minimize();
    };
    Vue.prototype.$maximazeApp = function(windowName: string) {
      const window = new OWWindow(windowName);
      if (maximized) {
        window.restore();
      } else {
        window.maximize();
      }
      maximized = !maximized;
    };
    Vue.prototype.$restoreApp = function(windowName: string) {
      const window = new OWWindow(windowName);
      window.restore();
    };
    Vue.prototype.$getWindowState = async function(windowName: string) {
      const window = new OWWindow(windowName);
      return await window.getWindowState();
    };
    Vue.prototype.$setDrag = async function(windowName: string, elem: HTMLElement) {
      const window = new OWWindow(windowName);
      window.dragMove(elem);
    };
  }
};
