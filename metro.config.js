const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  port: 5000,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      return middleware(req, res, next);
    };
  },
};

config.watcher = {
  ...config.watcher,
  watchman: false,
  healthCheck: {
    enabled: false,
  },
};

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [require('path').resolve(__dirname, 'node_modules')],
};

module.exports = withRorkMetro(config);
