# Decisiones fuera de lo especificado

Decisiones tomadas durante ATAL-5 que la historia no fijaba.

- **`/iniciar-US` sin subagentes.** El comando lee Jira, explora el repo y arma el plan directamente en la sesión, sin delegar en subagentes.
- **`/iniciar-US` no commitea por su cuenta ni suma coautor.** Los commits solo se hacen con autorización explícita del usuario y sin línea `Co-Authored-By`.

- **Paquetes compartidos sin paso de build.** `@atalaya/contracts` y `@atalaya/core` exponen `src/index.ts` directamente (`exports`), para que `typecheck` y `lint` funcionen en un clon limpio sin compilar antes. Su script `build` es `tsc --noEmit`. Los consumen `tsx`, Vite y `tsc` con `moduleResolution: Bundler`.
- **Salida de build de los servicios.** `gateway` y `pr-reviewer` compilan con `rootDir: ".."`, por lo que `dist/` refleja la estructura del repositorio. Es suficiente para un placeholder; se revisa en ATAL-6 si hace falta ejecutar desde `dist/`.
- **Aislamiento entre herramientas con ESLint.** La regla `no-restricted-imports` en `eslint.config.js` prohíbe que `pr-reviewer`, `gateway` y `web` se importen entre sí, por nombre de paquete o por ruta relativa. Se verificó que falla con un import prohibido.
- **ESLint sin `@eslint/js` ni `globals`.** No están en la lista de dependencias permitidas; se usa solo `typescript-eslint` (recomendado) y `eslint-config-prettier`.
- **Prettier.** `singleQuote`, `trailingComma: all`, `printWidth: 100` y `endOfLine: lf`. `lint` no verifica el formato. Se agrega `.gitattributes` con `* text=auto eol=lf`.
- **TypeScript.** Además de `strict`, se activan `noUncheckedIndexedAccess` y `noImplicitOverride`.
- **Placeholders.** Cada servicio importa `serviceBanner` de `@atalaya/contracts` e imprime su nombre, lo que prueba que el paquete se resuelve.
- **Web.** Vite está fijo a `127.0.0.1:5173` con `--strictPort`, como indica ADR-001.

## ATAL-22

- **CI.** `actions/checkout@v4` y `actions/setup-node@v4`, un solo job en `ubuntu-latest`, `permissions: contents: read` y `concurrency` que cancela runs obsoletos del mismo ref.
- **Nombre de ramas.** Se usa `ATAL-N-slug` (mayúsculas), como genera `/iniciar-US`, en lugar del `atal-N-slug` de la nota de la historia.
- **`.claude/`** se agrega a `.gitignore`.
