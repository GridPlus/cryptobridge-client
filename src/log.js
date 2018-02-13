// Logging
const winston = require('winston');

// This will be overwritten when we know where the log file should be;
let logger = null;
exports.logger = logger;


// Setup the winston logger
exports.setLogger = function(fPath) {
  logger = new (winston.Logger)({
    transports: [
      new (winston.transports.File)({ filename: `${fPath}/log`, json: false, timestamp: true }),
      new winston.transports.Console({ colorize: true, timestamp: true })
    ],
    // levels: customLevels.levels,
  })
  // winston.addColors(customLevels)
}

exports.getLogger = function() {
  return logger;
}

// The user can define a specific level for the logger. This enables null logging
// for test suites
exports.setLevel = function(level) {
  switch (level) {
    case 0:
      return nullLogger;
      break;
    default:
      return logger;
  }
}


let nullLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
  info: () => {},
}
