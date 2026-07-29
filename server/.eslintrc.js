module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2020: true,
  },
  ignorePatterns: ['dist', 'node_modules', 'uploads'],
  rules: {
    // Genuinely useful, not just style: catches accidentally-unused imports/vars,
    // which is exactly the kind of thing that hides dead code paths or leftover
    // debug scaffolding in a security-sensitive codebase.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off', // server logging is intentional (see app.ts / auth.controller.ts)
  },
};
