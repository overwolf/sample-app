<template>
  <div v-if="source.mark" class="logText markColors">{{ source.text }}</div>
  <div v-else class="logText">{{ source.text }}</div>
</template>

<script>
export default {
  name: "LogItem",
  props: {
    index: {
      type: Number
    },
    source: {
      type: Object,
      default() {
        return {};
      }
    }
  }
};
</script>

<style scoped>
.logText {
  font-family: "Roboto Mono", serif;
  font-size: 12px;
  line-height: 1.2;
  margin-bottom: 5px;
}
.markColors {
  color: #00defa;
  background: none;
}
</style>
