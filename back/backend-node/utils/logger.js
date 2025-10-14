// Conditional logging utility - turns off in production
const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  log: (...args) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },
  
  warn: (...args) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (!isProduction) {
      console.info(...args);
    }
  },
  
  debug: (...args) => {
    if (!isProduction) {
      console.debug(...args);
    }
  }
};

module.exports = logger;

