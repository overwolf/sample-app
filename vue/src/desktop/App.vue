<template>
  <v-app>
    <div ref="dragBar">
      <v-system-bar id="v-system-bar" color="#272727" height="30" app>
        <div class="d-flex align-center">
          <v-img src="@/assets/header_icon.svg"></v-img>
          <span id="title-text">{{ title }}</span>
        </div>
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

    <!-- Sizes your content based upon application components -->
    <v-main>
      <v-img src="@/assets/background.svg">
        <div id="topText">
          <div class="d-flex justify-center text-center">
            Overwolf Sample App
          </div>
          <p class="d-flex justify-center text-center">
            Welcome to the Overwolf tutorial app for developers.<br />
            Learn how to build an app by using one!
          </p>
        </div>
      </v-img>
      <v-container id="bottom">
        <v-row>
          <v-col cols="12" md="3">
            <div id="left" class=" d-flex justify-center text-left">
              Launch Fortnite and the In-Game window will pop-up automatically!
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div>
              What can you learn with this sample app?
              <br /><br />
              1. How to listen to real-time game events and how to identify
              specific events like start/end match, kill, and death.
              <br /><br />
              2. How to use a transparent background window as a service bus,
              that acts as the main controller of your app.
              <br /><br />
              3. How to use Hotkeys that show/hide your app while you are
              in-game.
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <v-img src="@/assets/cool_wolf.png"></v-img>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
<script>
export default {
  name: "desktop",
  data: () => ({
    title: "Sample App / desktop window"
  }),
  created() {
    this.$vuetify.theme.dark = true;
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
    }
  }
};
</script>
<style scoped>
.v-system-bar {
  padding-right: 0;
}
.v-col {
  padding: 24px;
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

#topText {
  margin-top: 40px;
}

#topText div {
  font-family: "Roboto Mono", serif !important;
  font-size: 24px;
}

#bottom {
  padding: 67px 0px 0px 0px;
}

#bottom #left {
  font-family: "Roboto Mono", serif !important;
}
</style>
