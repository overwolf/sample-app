<template>
  <v-app>
    <h1>{{ test }}</h1>
  </v-app>
</template>
<script>
export default {
  name: "App",
  data: () => ({
    test: "In game"
  }),
  mounted() {
    console.log("Hello In game");
    console.log("Overwolf version" + overwolf.version);
  }
};
</script>
<style></style>
