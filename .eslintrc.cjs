module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  },
  ignorePatterns: ['**/dist/**', '**/.next/**', '**/coverage/**', 'node_modules/', '**/next-env.d.ts'],
  overrides: [
    {
      files: ['apps/dashboard/**/*.{ts,tsx}'],
      extends: ['next/core-web-vitals'],
      settings: {
        next: { rootDir: 'apps/dashboard' }
      },
      env: {
        browser: true,
        node: false
      }
    }
  ]
};