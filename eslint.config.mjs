import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
export default [
  {
    ignores: [
      'node_modules/**',
      'clients/**/node_modules/**',
      '.cloudflare/**',
      '.wrangler/**',
      'tools/devkit/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{mjs,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser },
    plugins: { '@typescript-eslint': typescript },
    rules: { ...typescript.configs.recommended.rules },
  },
];
