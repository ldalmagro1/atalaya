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

// Herramientas con carpeta en web/src/tools/<toolId>/. Al sumar una herramienta nueva, agregar su id
// aquí: no puede importar de la carpeta de otra (ver web/src/tools/README.md).
const webTools = ['pr-reviewer'];

// Lo que la web nunca importa: otros servicios. Se excluye `src/` porque web/src/tools/pr-reviewer/
// es código de la web y sí se importa por ruta relativa.
const webBase = [
  '@atalaya/gateway',
  '@atalaya/pr-reviewer',
  '**/gateway/**',
  '**/pr-reviewer/src/**',
];

function webToolRules() {
  return webTools.map((tool) => {
    const others = webTools.filter((other) => other !== tool);
    return {
      files: [`web/src/tools/${tool}/**/*.{ts,tsx}`],
      rules: forbid(...webBase, ...others.map((other) => `**/${other}/**`)),
    };
  });
}

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
    rules: forbid(...webBase),
  },
  ...webToolRules(),
);
