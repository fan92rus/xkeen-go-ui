// Browser polyfill for Node.js process object
// Required by esm.sh CodeMirror modules

const process = {
  env: {},
  version: 'v18.0.0',
  versions: {},
  platform: 'browser',
  arch: 'browser',
  argv: [],
  cwd: () => '/',
  exit: () => {},
  nextTick: (fn, ...args) => Promise.resolve().then(() => fn(...args)),
  browser: true
};

export default process;
