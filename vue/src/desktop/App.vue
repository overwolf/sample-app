<template>
  <v-app>
    <h2 ref="dragButton">{{ test }}</h2>
    <v-btn color="primary">primary</v-btn>
    <v-btn color="secondary">secondary</v-btn>
    <v-btn color="accent">accent</v-btn>
    <v-btn color="error">error</v-btn>
    <v-btn color="warning">warning</v-btn>
    <v-btn color="info">info</v-btn>
    <v-btn color="success">success</v-btn>
  </v-app>
</template>
<script>
export default {
  name: "App",
  data: () => ({
    test: "Desktop"
  }),
  mounted() {
    console.log("Hello Desktop");
    console.log("Overwolf version" + overwolf.version);
    this.$setDrag("desktop", this.$refs.dragButton);

  }
};
</script>
<style>

</style>
