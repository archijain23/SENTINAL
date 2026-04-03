/**
 * Retry an async function with exponential backoff.
 */
const withRetry = async (fn, attempts = 3, delayMs = 200) => {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise(res => setTimeout(res, delayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
};

module.exports = { withRetry };
