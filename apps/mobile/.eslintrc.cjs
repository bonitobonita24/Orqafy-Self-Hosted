module.exports = {
  root: false,
  extends: [
    '../../.eslintrc.js',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
  ],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: { version: 'detect' },
  },
  // NOTE: the `env: { 'react-native/react-native': true }` key from the CHUNK-1
  // spec requires `eslint-plugin-react-native`, which is NOT in the declared
  // devDeps. That env only injects RN globals (`__DEV__`, etc.) which no source
  // here uses, so it is intentionally omitted to keep the dep set as specified.
};
