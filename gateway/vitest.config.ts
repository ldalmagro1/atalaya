import { configDefaults, defineConfig } from 'vitest/config';

// `npm run build` emite los `*.test.js` a `dist/`; no deben correr como tests.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '**/dist/**'] },
});
