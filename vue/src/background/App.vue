<template>
  <v-app>
    <h1>{{ test }}</h1>
  </v-app>
</template>
<script>
export default {
  name: "App",
  data: () => ({
    test: "Background"
  }),
  mounted() {
    console.log("Hello Background");
    console.log("Overwolf version" + overwolf.version);
  }
};
</script>
<style>

</style>
