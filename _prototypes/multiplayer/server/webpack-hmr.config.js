const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

// Same HMR recipe as api/webpack-hmr.config.js, including the poll, because the
// bind mount from the Windows host into the Linux container does not deliver
// native filesystem events reliably.
module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({ paths: [/\.js$/, /\.d\.ts$/] }),
      new RunScriptWebpackPlugin({ name: options.output.filename, autoRestart: false }),
    ],
    watchOptions: {
      poll: 300,
      aggregateTimeout: 200,
    },
  };
};
