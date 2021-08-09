module.exports = {
  transpileDependencies: ["vuetify"],
  pages: {
    background: {
      entry: "src/background/main.js",
      template: "public/index.html",
      filename: "background.html",
      title: "Example - Background"
    },
    desktop: {
      entry: "src/desktop/main.js",
      template: "public/index.html",
      filename: "desktop.html",
      title: "Example - Desktop"
    },
    in_game: {
      entry: "src/in_game/main.js",
      template: "public/index.html",
      filename: "in_game.html",
      title: "Example - In game"
    }
  },
  productionSourceMap: false,
  configureWebpack: {
    devtool: false
  }
};
