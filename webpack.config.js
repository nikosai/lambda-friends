module.exports = { 
  entry: `./js/webui.js`,
  output: {
    path: `${__dirname}/docs`,
    filename: 'app.js'
  },
  mode: 'development',
  // mode: 'production',
  target: "node",
};
