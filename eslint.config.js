import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Regla de aislamiento (ADR-001): ninguna herramienta importa código de otra
// ni de gateway/. Los servicios se comunican por HTTP con los tipos de @atalaya/contracts.
const forbid = (...patterns) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: patterns.map((group) => ({
        group: [group],
        message: 'Los servicios no se importan entre sí (ADR-001). Usá HTTP y @atalaya/contracts.',
      })),
    },
  ],
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'data/**', 'documents/**'] },
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['pr-reviewer/**/*.{ts,tsx}'],
    rules: forbid('@atalaya/gateway', '@atalaya/web', '**/gateway/**', '**/web/**'),
  },
  {
    files: ['gateway/**/*.{ts,tsx}'],
    rules: forbid('@atalaya/pr-reviewer', '@atalaya/web', '**/pr-reviewer/**', '**/web/**'),
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    rules: forbid('@atalaya/gateway', '@atalaya/pr-reviewer', '**/gateway/**', '**/pr-reviewer/**'),
  },
);
