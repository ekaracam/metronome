module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last — the worklets plugin (Reanimated 4) has to run after everything else.
    plugins: ['react-native-worklets/plugin'],
  };
};
