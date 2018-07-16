module.exports = { 
  entry: `./js/webui.js`,
  output: {
    path: `${__dirname}/docs`,
    filename: 'app.js'
  },
  mode: 'production',
  target: "node",
};
