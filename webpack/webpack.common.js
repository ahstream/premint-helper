const path = require('path');

const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  entry: {
    serviceWorker: './src/js/serviceWorker.js',
    popup: './src/pages/popup/popup.js',
    options: './src/pages/options/options.js',
    help: './src/pages/help/help.js',
    shortcuts: './src/pages/shortcuts/shortcuts.js',
    alphabotResults: './src/pages/alphabotResults/alphabotResults.js',
    premintPage: './src/js/premintPage.js',
    alphabotRafflePage: './src/js/alphabotRafflePage.js',
    alphabotMainPage: './src/js/alphabotMainPage.js',
    discordPage: './src/js/discordPage.js',
    twitterPage: './src/js/twitterPage.js',
    twitterIntentPage: './src/js/twitterIntentPage.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../', 'dist'),
    clean: true,
  },
  optimization: {
    minimizer: [new CssMinimizerPlugin()],
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)x?$/,
        use: ['babel-loader'],
        exclude: /node_modules/,
      },
      {
        test: /\.(scss|css)$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
    ],
  },
  plugins: [
    new ESLintPlugin(),
    new MiniCssExtractPlugin({ filename: 'styles/[name].css' }),
    new CopyPlugin({ patterns: [{ from: 'src/manifest.json' }] }),
    new CopyPlugin({ patterns: [{ from: 'src/images/', to: 'images/' }] }),
    new CopyPlugin({ patterns: [{ from: 'src/pages/**/*.html', to: '[name][ext]' }] }),
    new NodePolyfillPlugin(),
  ],
  resolve: {
    extensions: ['.js'],
    fallback: {
      fs: false,
      tls: false,
      net: false,
      child_process: false,
      stream: require.resolve('readable-stream'),
    },
  },
};
