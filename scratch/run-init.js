const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'next/env' || id === '@next/env') {
    const mock = {
      loadEnvConfig: () => ({ loadedEnvFiles: [] })
    };
    mock.default = mock;
    return mock;
  }
  return originalRequire.apply(this, arguments);
};

console.log("Mocked next/env and @next/env successfully.");

// Load the typescript file using tsx loader inside a try-catch, and use process.on('unhandledRejection')
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  const script = require('../scripts/init-payload.ts');
  if (script && typeof script.then === 'function') {
    script.catch(err => {
      console.error("Script promise failed:", err);
    });
  }
} catch (e) {
  console.error("Require failed:", e);
}
