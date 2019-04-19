module.exports = {
  env: {
    node: true,
    es6: true,
    mocha: true
  },
  extends: 'standard',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  rules: {
    'max-len': 'warn',
    'eol-last': 'off'
  }
}
