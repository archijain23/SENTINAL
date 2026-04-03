const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new transports.Console({
      silent: process.env.NODE_ENV === 'test',
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat)
    })
  ]
});

if (process.env.NODE_ENV !== 'test') {
  logger.add(new transports.File({
    filename: path.join(__dirname, '../../../logs/error.log'),
    level: 'error'
  }));
  logger.add(new transports.File({
    filename: path.join(__dirname, '../../../logs/combined.log')
  }));
}

logger.stream = {
  write: (message) => logger.http(message.trim())
};

module.exports = logger;
