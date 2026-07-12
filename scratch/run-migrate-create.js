const Module = require('module');
const path = require('path');
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

const binPath = path.resolve(__dirname, '../node_modules/payload/bin.js');

// Set process.argv to simulate "payload migrate:create add_institutions"
process.argv = [
  process.argv[0],
  binPath,
  'migrate:create',
  'add_institutions'
];

// Dynamically import the ES module directly by its file URL
import('file:///' + binPath.replace(/\\/g, '/')).catch(console.error);
