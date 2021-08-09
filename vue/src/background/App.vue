<template>
  <v-app>
    <h1>{{ title }}</h1>
  </v-app>
</template>
<script>
import { windowNames, fortniteClassId } from "../plugins/consts";
import { OWGames, OWGameListener, OWWindow } from "@overwolf/overwolf-api-ts";
export default {
  name: "App",
  data: () => ({
    title: "Background",
    windows: {},
    fortniteGameListener: undefined
  }),
  mounted() {
    this.windows[windowNames.desktop] = new OWWindow(windowNames.desktop);
    this.windows[windowNames.inGame] = new OWWindow(windowNames.inGame);

    this.fortniteGameListener = new OWGameListener({
      onGameStarted: this.toggleWindows.bind(this),
      onGameEnded: this.toggleWindows.bind(this)
    });

    this.run();
  },
  methods: {
    isGameFortnite(info) {
      return info.classId === fortniteClassId;
    },
    toggleWindows(info) {
      if (!info || !this.isGameFortnite(info)) {
        return;
      }

      if (info.isRunning) {
        this._windows[windowNames.desktop].close();
        this._windows[windowNames.inGame].restore();
      } else {
        this._windows[windowNames.inGame].close();
        this._windows[windowNames.desktop].restore();
      }
    },
    async isFortniteRunning() {
      const info = await OWGames.getRunningGameInfo();

      return info && info.isRunning && this.isGameFortnite(info);
    },
    async run() {
      this.fortniteGameListener.start();
      const currWindow = (await this.isFortniteRunning())
        ? windowNames.inGame
        : windowNames.desktop;
      this.windows[currWindow].restore();
    }
  }
};
</script>
<style></style>
