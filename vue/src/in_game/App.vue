<template>
  <v-app>
    <div ref="dragBar">
      <v-system-bar id="v-system-bar" color="#272727" height="30" app>
        <div class="d-flex align-center">
          <v-img src="@/assets/header_icon.svg"></v-img>
          <span id="title-text">{{ title }}</span>
        </div>
        <v-spacer></v-spacer>
        <span
          >Show/Hide: <span class="font-weight-bold">{{ shortcut }}</span></span
        >
        <v-spacer></v-spacer>
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
      </v-system-bar>
    </div>
  </v-app>
</template>
<script>
import { hotkeys, fortniteClassId } from "../plugins/consts";
import { OWHotkeys } from "@overwolf/overwolf-api-ts";
export default {
  name: "in_game",
  data: () => ({
    title: "Sample App / in-game window",
    shortcut: "",
    WindowStates: undefined
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
