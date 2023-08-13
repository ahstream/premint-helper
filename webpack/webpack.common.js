const path = require('path');

const DotenvPlugin = require('dotenv-webpack');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  entry: {
    serviceWorker: './src/serviceWorker.js',
    popup: './src/popup.js',
    options: './src/options.js',
    bookmark: './src/bookmark.js',
    help: './src/help.js',
    twitterPage: './src/twitterPage.js',
    twitterIntentPage: './src/twitterIntentPage.js',
    discordPage: './src/discordPage.js',
    premintPage: './src/premintPage.js',
    alphabotRafflePage: './src/alphabotRafflePage.js',
    alphabotMainPage: './src/alphabotMainPage.js',
    alphabotResults: './src/alphabotResults.js',
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
    new DotenvPlugin(),
    new ESLintPlugin(),
    new MiniCssExtractPlugin({ filename: 'styles/[name].css' }),
    new CopyPlugin({ patterns: [{ from: 'static' }] }),
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
