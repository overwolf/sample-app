import Vue from "vue";
import App from "./App.vue";
import vuetify from "@/plugins/vuetify";
import windowFunctions from "@/plugins/appWindow";

Vue.use(windowFunctions);
Vue.config.productionTip = false;

new Vue({
  vuetify,
  render: h => h(App)
}).$mount("#app");
