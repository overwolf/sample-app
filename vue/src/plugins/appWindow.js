import { OWWindow } from "@overwolf/overwolf-api-ts/dist";

export default {
  install(Vue) {
    Vue.prototype.$mainWindow = new OWWindow("background");
    var maximized = false;

    Vue.prototype.$closeApp = function() {
      this.$mainWindow.close();
    };
    Vue.prototype.$minimizeApp = function(windowName) {
      let window = new OWWindow(windowName);
      window.minimize();
    };
    Vue.prototype.$maximazeApp = function(windowName) {
      let window = new OWWindow(windowName);
      if (maximized) {
        window.restore();
      } else {
        window.maximize();
      }
      maximized = !maximized;
    };
    Vue.prototype.$getWindowState = async function(windowName) {
      let window = new OWWindow(windowName);
      return await window.getWindowState();
    };
    Vue.prototype.$setDrag = async function(windowName, elem) {
      let window = new OWWindow(windowName);
      window.dragMove(elem);
    };
  }
};
