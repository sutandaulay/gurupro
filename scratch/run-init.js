const fs = require('fs');
const path = require('path');
const Module = require('module');

// Load environment variables manually
function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`Loading env file: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = val;
        }
      }
    });
  }
}

loadEnv(path.join(__dirname, '../.env'));
loadEnv(path.join(__dirname, '../.env.local'));

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
  const script = require('../scripts/init-production.ts');
  if (script && typeof script.then === 'function') {
    script.catch(err => {
      console.error("Script promise failed:", err);
    });
  }
} catch (e) {
  console.error("Require failed:", e);
}
