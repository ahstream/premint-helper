const path = require('path');

const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  entry: {
    serviceWorker: './src/js/serviceWorker.js',
    popup: './src/js/popup.js',
    options: './src/js/options.js',
    bookmark: './src/js/bookmark.js',
    help: './src/js/help.js',
    twitterPage: './src/js/twitterPage.js',
    twitterIntentPage: './src/js/twitterIntentPage.js',
    discordPage: './src/js/discordPage.js',
    premintPage: './src/js/premintPage.js',
    alphabotRafflePage: './src/js/alphabotRafflePage.js',
    alphabotMainPage: './src/js/alphabotMainPage.js',
    alphabotResults: './src/js/alphabotResults.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../', 'dist'),
    clean: true,
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
    new CopyPlugin({ patterns: [{ from: 'src/static' }] }),
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
