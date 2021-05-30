module.exports = { 
  entry: `./src/webui.tsx`,
  output: {
    path: `${__dirname}/docs`,
    filename: 'app.js'
  },
  mode: 'development',
  // mode: 'production',
  module: {
    rules: [
      {
        // 拡張子 .ts もしくは .tsx の場合
        test: /\.tsx?$/,
        // TypeScript をコンパイルする
        use: "ts-loader",
      },
    ],
  },
  // import 文で .ts や .tsx ファイルを解決するため
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
  },
  // // ES5(IE11等)向けの指定
  // target: ["node", "web", "es5"],
  target: "node"
};
