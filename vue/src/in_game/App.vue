<template>
  <v-app>
    <div ref="dragBar">
      <v-system-bar id="v-system-bar" color="#272727" height="30" app>
        <v-row align="center" no-gutters>
          <v-col class="d-flex align-center" align="start">
            <div class="d-flex align-center">
              <v-img width="30px" src="@/assets/header_icon.svg"></v-img>
              <span id="title-text">{{ title }}</span>
            </div>
          </v-col>
          <v-col align="center">
            <span
              >Show/Hide:
              <span class="font-weight-bold white--text">{{ shortcut }}</span></span
            >
          </v-col>
          <v-col align="end">
            <div>
              <v-btn @click="minimize" small icon depressed tile>
                <svg>
                  <use
                    xlink:href="@/assets/header_icons.svg#window-control_minimize"
                  />
                </svg>
              </v-btn>
              <v-btn @click="maximize" small icon depressed tile>
                <svg>
                  <use
                    xlink:href="@/assets/header_icons.svg#window-control_maximize"
                  />
                </svg>
              </v-btn>
              <v-btn id="closeButton" @click="close" small icon depressed tile>
                <svg>
                  <use
                    xlink:href="@/assets/header_icons.svg#window-control_close"
                  />
                </svg>
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-system-bar>
      <v-main>
        <v-container fluid>
          <v-row justify="center">
            <v-col cols="auto" md="4">
              <v-card flat color="background">
                <v-card-title>Game Events</v-card-title>
                <v-card
                  min-height="500px"
                  max-height="500px"
                  flat
                  color="card_background"
                >
                  <v-card-text>
                    <text-highlight
                      :highlightStyle="markHighlight"
                      :queries="wordsToHighlight"
                      >{{ eventText }}</text-highlight
                    >
                  </v-card-text>
                </v-card>
              </v-card>
            </v-col>
            <v-col cols="auto" md="4">
              <v-card flat color="background">
                <v-card-title>Info Updates</v-card-title>
                <v-card
                  min-height="500px"
                  max-height="500px"
                  flat
                  color="card_background"
                >
                  <v-card-text>
                    <text-highlight :highlightStyle="markHighlight" queries="version">{{
                      infoText
                    }}</text-highlight>
                  </v-card-text>
                </v-card>
              </v-card>
            </v-col>
            <v-col cols="auto" md="3">
              <v-card flat color="background">
                <v-card-title>Real time Game Data</v-card-title>
                <v-card-text>
                  The background controller of this app is listening to all the
                  game events and info updates, and sends them to this window,
                  that prints them to the screen. Some specific events
                  (startMatch, Kill and Death) are painted in
                  <span style="color: #00DEFA">teal</span> and logged to the
                  developers console.
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-main>
    </div>
  </v-app>
</template>
<script>
import {
  hotkeys,
  fortniteClassId,
  interestingFeatures
} from "../plugins/consts";
import { OWHotkeys, OWGamesEvents } from "@overwolf/overwolf-api-ts";
export default {
  name: "in_game",
  data: () => ({
    title: "Sample App / in-game window",
    shortcut: "",
    WindowStates: undefined,
    fortniteGameEventsListener: undefined,
    wordsToHighlight: [
      "kill",
      "death",
      "assist",
      "level",
      "matchStart",
      "matchEnd"
    ],
    infoText: "",
    eventText: "",
    markHighlight: {
      color: "#00DEFA",
      background: "none"
    }
  }),
  async created() {
    this.$vuetify.theme.dark = true;
    OWHotkeys.onHotkeyDown(hotkeys.toggle, this.toggleInGameWindow);
    this.shortcut = await OWHotkeys.getHotkeyText(
      hotkeys.toggle,
      fortniteClassId
    );
  },
  mounted() {
    this.$setDrag(this.$options.name, this.$refs.dragBar);

    this.fortniteGameEventsListener = new OWGamesEvents(
      {
        onInfoUpdates: this.onInfoUpdates.bind(this),
        onNewEvents: this.onNewEvents.bind(this)
      },
      interestingFeatures
    );

    this.run();
  },
  methods: {
    minimize() {
      this.$minimizeApp(this.$options.name);
    },
    maximize() {
      this.$maximazeApp(this.$options.name);
    },
    close() {
      this.$closeApp();
    },
    restore() {
      this.$restoreApp(this.$options.name);
    },
    async toggleInGameWindow(hotkeyResult) {
      console.log(`pressed hotkey for ${hotkeyResult.name}`);
      const inGameState = await this.$getWindowState(this.$options.name);

      if (
        inGameState.window_state === "normal" ||
        inGameState.window_state === "maximized"
      ) {
        this.minimize();
      } else if (
        inGameState.window_state === "minimized" ||
        inGameState.window_state === "closed"
      ) {
        this.restore();
      }
    },
    logLine(log, data) {
      console.log(`${log}Log:`);
      console.log(data);
      const text = JSON.stringify(data) + "\n\n";

      if (log === "info") {
        this.infoText += text;
      } else if (log === "event") {
        this.eventText += text;
      }
    },
    onInfoUpdates(info) {
      this.logLine("info", info);
    },
    onNewEvents(e) {
      this.logLine("event", e);
    },
    async run() {
      this.fortniteGameEventsListener.start();
    }
  }
};
</script>
<style scoped>
.v-system-bar {
  padding-right: 0;
}
svg {
  width: 30px;
  height: 30px;
  color: rgba(255, 255, 255, 0.7);
}

#closeButton span svg:hover {
  background-color: var(--v-error-base);
}

#title-text {
  margin-left: 0.5em;
}
</style>
