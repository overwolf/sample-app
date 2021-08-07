import "@fortawesome/fontawesome-free/css/all.css";
import Vue from "vue";
import Vuetify from "vuetify/lib/framework";
import colors from "vuetify/es5/util/colors";

Vue.use(Vuetify);

export default new Vuetify({
  icons: {
    iconfont: "fa"
  },
  theme: {
    themes: {
      light: {
        primary: colors.purple,
        secondary: colors.teal,
        accent: colors.cyan,
        error: colors.red,
        warning: colors.orange,
        info: colors.blue.base,
        success: colors.green
      },
      dark: {
        primary: colors.purple,
        secondary: colors.teal,
        accent: colors.cyan,
        error: colors.red,
        warning: colors.orange,
        info: colors.blue.base,
        success: colors.green
      }
    },
    options: { customProperties: true }
  }
});
