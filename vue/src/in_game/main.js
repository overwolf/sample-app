import Vue from "vue";
import App from "./App.vue";
import vuetify from "@/plugins/vuetify";
import windowFunctions from "@/plugins/appWindow";
import TextHighlight from "vue-text-highlight";

Vue.use(windowFunctions);
Vue.config.productionTip = false;

Vue.component("text-highlight", TextHighlight);

new Vue({
  vuetify,
  render: h => h(App)
}).$mount("#app");
