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
- **Lockfile y `npm ci` en Linux.** El lock generado en Windows omitía `@emnapi/core` y `@emnapi/runtime` (dependencias del binding wasm opcional), y `npm ci` fallaba en el runner. Se agregan como `devDependencies` exactas (`2.0.0-beta.2`) para que el lock quede completo en cualquier plataforma.
- **CI desglosado.** Cada paso (Typecheck, Lint, Formato, Tests, Build) es un job propio, definido con una matriz, para que cada uno aparezca como un chequeo separado en el PR. `fail-fast: false` deja correr todos aunque uno falle. Al activar la protección de `main`, exigir los cinco chequeos.
- **Secretos, tres capas.** (1) Hook de pre-commit con husky y `secretlint` (paquete de npm, sin binarios que instalar; se activa solo con `npm install` por el script `prepare`); `npm run secrets:check` lo corre sobre todo el repo. (2) Job `Secretos` en el CI con `gitleaks-action`, que escanea el historial del PR con `fetch-depth: 0`; es un sexto chequeo a exigir en la protección de `main`. (3) Secret scanning y push protection de GitHub, que ya vienen activos en repos públicos. Los patrones genéricos de GitHub (`secret_scanning_non_provider_patterns`) no están disponibles en el plan gratuito: la API los rechaza y la opción no aparece en la web. Los secretos genéricos (contraseñas, claves privadas) los cubren gitleaks en el CI y secretlint en el pre-commit. Se usan dos herramientas (secretlint local, gitleaks en CI) para no exigir un binario en cada máquina.
- **Verificador de aceptación E2E.** Se registra como idea en `alcances-segunda-etapa.md` (SE-009) y en la tabla del README, sin compromiso de sprint.

## ATAL-26

- **Escalones de hosting.** Local con Cloudflare Tunnel y Access en `atalaya-dev.lucasdalmagro.com` (este equipo), luego otra computadora de casa y, solo si no hay máquina, Google Cloud e2-micro (Always Free). Detalle en `ADR-004`.
- **Raspberry Pi como idea a muy largo plazo.** Se anota en `ADR-004` sin compromiso ni plan de compra; no se investigó su compatibilidad.
- **Un solo usuario al inicio.** El multiusuario (login propio con GitHub App, tokens por usuario cifrados, datos por usuario) es una fase posterior y no se implementa ni se documenta como regla vigente. ADR-003 no cambia.
- **Disponibilidad.** La URL responde solo mientras el equipo esté encendido; se acepta. Sin CD ni ambiente productivo (SE-006 sigue fuera de alcance).
- **`CLAUDE.md` y ADR-001.** Se agrega la regla de publicación (Tunnel, Access, validación del JWT, CORS con el dominio) sin cambiar el resto. La regla de tokens solo en `.env` se mantiene mientras haya un solo usuario.
- **Delegación a subagentes.** Durante el discovery se intentó delegar la lectura de páginas oficiales en subagentes, contra la regla del proyecto. Una lectura se ejecutó (Litestream y R2) y las demás se hicieron con búsquedas directas.
- **Sin historias creadas.** Las historias derivadas se proponen en el comentario de ATAL-26; las crea Lucas si las acepta.
- **Fuentes.** Las cifras de precios y límites son del 23/11/2026, de resúmenes de búsqueda y no de lecturas completas, y se marcan como no verificadas cuando corresponde.

## ATAL-21

- **`CLAUDE.md` adaptado a lo posterior a la historia.** Se parte del texto de la historia y se actualiza con lo que se implementó después: `/iniciar-US` como forma de arrancar (sin subagentes y con confirmación del plan), commits solo con autorización y sin coautor, registro de decisiones en `DECISIONES.md`, control de secretos (secretlint, gitleaks) y `secrets:check` entre los comandos. Se conservan las reglas que ya tenía el archivo (idioma, commits, decisiones).
- **Ramas `ATAL-N-slug`** en mayúsculas, como en ATAL-22, en lugar del `atal-N-slug` de la historia.
- **Español neutro** en lugar del voseo del texto de la historia, como el resto del repo. El archivo lo cumple y la regla de Lucas «responde siempre en español» pasa a la primera sección.
- **Husky y secretlint** se suman a las herramientas de desarrollo que no cuentan como dependencias de stack nuevas.
