// Logging
const winston = require('winston');

// This will be overwritten when we know where the log file should be;
let logger = null;
exports.logger = logger;

// Setup the winston logger
exports.setLogger = function(fPath) {
  logger = new (winston.Logger)({
    transports: [
      new (winston.transports.File)({ filename: `${fPath}/log`, json: false, timestamp: true })
    ]
  })
}

exports.getLogger = function() {
  return logger;
}
