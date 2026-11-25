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

## ATAL-27

- **`CLAUDE.md`: nueva regla de dependencias.** Antes exigía una historia aparte para sumar una dependencia de stack. Ahora basta justificarla en el plan de la historia y que el usuario la confirme; la decisión se registra aquí. Lo pidió Lucas al elegir el parser SQL.
- **`node-sql-parser` para validar migraciones.** El ejecutor parsea cada migración con el dialecto SQLite y recorre el AST: toda tabla, índice, trigger o vista (incluidos los de dentro de un trigger), todo `REFERENCES` (en línea, de tabla o en `ALTER ... ADD COLUMN`) y todo `RENAME TO` debe empezar con el prefijo del servicio. Se probó antes de adoptarlo; la alternativa de respaldo era correr la migración en una base en memoria y leer `sqlite_master`. Pesa unos 90 MB en `node_modules` (trae todos los dialectos), pero solo se usa en `packages/core`.
- **La validación falla cerrado.** Lo que el parser no entiende se rechaza: `PRAGMA`, `CREATE VIRTUAL TABLE`, `DROP INDEX` y cualquier sentencia que no sea `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE` o `REPLACE` (por ejemplo `BEGIN`/`COMMIT`, que chocarían con la transacción del ejecutor). Si una herramienta necesita algo de eso, se amplía el validador en una historia propia. También se rechazan los nombres calificados con esquema (`main.tabla`).
- **Se valida todo antes de aplicar nada.** Si una migración pendiente es inválida, ninguna de las pendientes de ese servicio se ejecuta. Cada migración válida corre en su propia transacción junto con su registro en `core_migrations`.
- **Nombres de migración.** `NNN_nombre.sql` (tres dígitos o más, letras, números, `_` y `-`); un `.sql` que no cumpla el patrón es un error y no se ignora. El orden es el alfabético del nombre. La carpeta debe existir (en `pr-reviewer` se conserva con un `.gitkeep`).
- **Prefijos.** Deben ser minúsculas con un `_` final. `core_` solo lo puede usar el servicio `core`; la tabla `core_migrations` la crea el propio ejecutor, sin pasar por la validación.
- **Errores.** Además de lo que pide la historia: un error HTTP 4xx de Fastify (por ejemplo, JSON mal formado) responde con su estado y `code: BAD_REQUEST`, y cualquier otro error responde 500 `INTERNAL_ERROR` con un mensaje fijo, sin filtrar el detalle (queda en el log).
- **Token en todas las rutas.** El hook `onRequest` corre antes que el manejador de rutas inexistentes, así que un pedido sin token recibe 401 incluso en rutas que no existen. La comparación es en tiempo constante (`timingSafeEqual` sobre el SHA-256 de ambos valores, para que el largo no cuente). `createServiceApp` rechaza un token vacío.
- **Logs.** Se redactan `x-atalaya-internal-token`, `authorization`, `cookie` y `set-cookie` (Fastify de por sí no registra cabeceras de pedido). `createServiceApp` acepta un `logger` opcional (nivel y destino) solo para poder capturar los logs en los tests.
- **`config.ts` de `pr-reviewer`.** Valida con zod: `PR_REVIEWER_PORT` (1-65535), `INTERNAL_TOKEN` (32 caracteres o más, como pide `.env.example`) y `DB_PATH` (por defecto `./data/atalaya.db`). Una ruta relativa se resuelve desde la raíz del repo y no desde el directorio actual, porque `npm run dev -w` corre dentro de `pr-reviewer/`. Los errores nombran las variables, nunca sus valores. El `.env` de la raíz se carga con `process.loadEnvFile`, sin dependencia nueva (requiere Node 20.12 o superior; el mínimo del proyecto es Node 24, ver más abajo).
- **Build de `pr-reviewer`.** Sigue con `tsc` y `rootDir: ".."`; el servicio se ejecuta con `tsx`, no desde `dist/` (lo retoma ATAL-6, como ya se anotó).
- **Fuera de alcance.** El registro del servicio en el gateway (ATAL-6) y el test que recorre las consultas SQL de cada servicio (ADR-003, punto 4).
- **Mínimo de Node sube a 24.** `better-sqlite3` 13 exige Node 22 o superior y el CI corría con Node 20: el binario nativo terminaba el worker de vitest con SIGSEGV. Además, Node 20 salió de soporte en abril de 2026. En vez de fijar `better-sqlite3` en la serie 12, se sube el mínimo del proyecto a Node 24 (LTS activa, con soporte hasta 2028, la misma que usa Lucas en local): `ci.yml`, `engines`, `CLAUDE.md` y los README. Node 22 se descartó por su fin de vida en abril de 2027.

## ATAL-6

- **`createServiceApp` no se usa en el gateway.** Esa fábrica es para los servicios (sin CORS, con token obligatorio). El gateway arma su propia app Fastify con `registerErrorHandling` de core, CORS acotado y el mismo `redact` de logs.
- **Módulos.** `app.ts` exporta `buildApp(opciones)`, que no lee `process.env` ni abre la base, así que los tests lo usan con servicios de prueba. `index.ts` lee la config, abre la base, corre las migraciones (carpeta vacía, con `.gitkeep`) y escucha con `listenLocal`. `upstream.ts` concentra la llamada a los servicios (token interno, tiempo máximo y sin seguir redirecciones).
- **`GET /api/health` usa health y manifest.** `/internal/health` no trae la versión, así que se consultan ambos endpoints. Una herramienta es `ok: true` solo si los dos responden bien; si no, `ok: false` y `version: null`. Tiempo máximo de 1,5 s por herramienta.
- **`GET /api/tools` omite las herramientas que no responden.** La historia no dice qué hacer con una herramienta caída; se devuelve solo las que entregan manifiesto y el estado de las caídas se ve en `/api/health`.
- **Validación 400 real: el id de herramienta.** `:toolId` debe cumplir `^[a-z][a-z0-9_]*$` (zod); si no, 400 `VALIDATION_ERROR`. Un id válido pero no registrado da 404 `TOOL_NOT_FOUND`.
- **El proxy no expone `/internal/*` ni acepta `.` o `..`.** Cualquier ruta restante que empiece con `internal/` o tenga segmentos `.`/`..` (también codificados) da 404 `NOT_FOUND`. Si no, el gateway, que agrega el token, serviría los endpoints internos de cada servicio. No lo pedía la historia.
- **El proxy usa listas de cabeceras permitidas.** Al servicio solo van `content-type`, `accept`, `accept-language` y el token interno (el del navegador, si lo trae, se descarta). Del servicio al navegador solo vuelven `content-type`, `cache-control` y `etag`, así que no pasan `set-cookie` ni el token. El cuerpo se reenvía como bytes, sin parsearlo; el tiempo máximo del proxy es de 30 s.
- **CORS.** `@fastify/cors` con la lista fija de orígenes; un origen ajeno no recibe cabeceras `access-control-*` (el navegador lo bloquea). El rechazo de la conexión no se hace en el servidor.
- **Dependencias.** `fastify`, `zod`, `@fastify/cors` (con `@atalaya/core`) declaradas en `gateway/package.json`; `@fastify/cors` es la que nombra la historia.
- **Puertos en `config.ts`.** `GATEWAY_PORT` y `PR_REVIEWER_PORT` tienen valor por defecto (3001 y 3101); `INTERNAL_TOKEN` es obligatorio. Sin token válido, `index.ts` imprime el error y sale con código 1.

## ATAL-25

- **Dependencias nuevas (confirmadas por Lucas en el plan).** En `web`: `react-router-dom` 6, `react-markdown`, `remark-gfm`, `@fontsource/inter`, `@fontsource/ibm-plex-sans-thai` y `zod` (para tipar el cliente de API); como herramientas de build `tailwindcss` 3, `postcss` y `autoprefixer`; como herramientas de test `jsdom`, `@testing-library/react` y `@testing-library/user-event`. En `@atalaya/contracts`: `zod`. `react-router-dom` queda en la serie 6 (la 7 cambia el paquete y la API; la historia solo dice «React Router»).
- **Tipos de salud en `contracts`.** Se agregan `healthResponseSchema`, `toolsResponseSchema` y `apiErrorSchema` (zod) a `packages/contracts`. El cliente de la web valida con ellos toda respuesta del gateway; el gateway todavía no los usa (queda para una historia propia).
- **Hover del botón primario.** Con `hover:bg-primary-600` el texto oscuro fijo daba unos 4:1 en tema claro, por debajo del 6:1 de la historia. Se usa `hover:bg-primary-400` en claro y `dark:hover:bg-primary-600` en oscuro (la escala está invertida, así que ambos son el lado más claro). Un test lee `main.css` y verifica ≥ 6:1 para el estado normal y el hover en los dos temas.
- **Tests de la web.** vitest con `jsdom` y Testing Library. `test.css.include` deja pasar `main.css` para que el test de contraste lo lea con `?raw` (por defecto vitest vacía los CSS).
- **Errores del cliente de API.** `ApiRequestError` con `code`, `message` y `status`: `NETWORK_ERROR` (sin respuesta, `status` 0), `HTTP_ERROR` (error sin la forma `{ code, message }`) e `INVALID_RESPONSE` (la respuesta no cumple el schema).
- **`HealthBanner`.** Tres estados: gateway inaccesible (alerta roja con «Reintentar»), herramientas caídas (alerta ámbar con sus ids) y todo en orden. `useAsync` cancela con `AbortSignal` al desmontar o al recargar.
- **`MarkdownView`.** Sin `rehype-raw`: el HTML crudo se ve como texto. Los enlaces abren con `target="_blank"` y `rel="noopener noreferrer"`. react-markdown ya descarta URLs `javascript:`; hay un test.
- **Aislamiento de `web/src/tools/<toolId>/`.** `eslint.config.js` tiene una lista `webTools`: cada herramienta no puede importar de la carpeta de otra. Hay que sumar el id de cada herramienta nueva a esa lista. También se acotó la regla de `web` de `**/pr-reviewer/**` a `**/pr-reviewer/src/**`, para no bloquear la futura carpeta `web/src/tools/pr-reviewer/`. Se verificó con dos herramientas de prueba (bloquea el cruce, permite imports propios).
- **Tema.** Clave de `localStorage`: `atalaya-theme`. Un valor guardado inválido se ignora y se usa `prefers-color-scheme`.
- **Textos en español neutro** (sin voseo) en la interfaz.
- **Paleta turquesa en lugar del verde oliva de la historia.** Lucas pidió, tras ver la interfaz, cambiar las escalas verdes «militares» por verdes turquesa, sobre todo en tema oscuro. Se regeneran las cinco escalas (`text`, `background`, `primary`, `secondary`, `accent`) con HSL: `text` 164°/10 %, `background` 162°/22 %, `primary` 158°/62 %, `secondary` 168°/58 % y `accent` 152°/66 % (una primera versión, con matices de 166° a 186°, salió demasiado celeste y Lucas pidió acercarla al verde), con 11 escalones de luminosidad (97 % a 6 %) y el tema oscuro como inversión del claro. Los nombres de tokens no cambian. Solo en el tema claro se oscurecen `text-600` y `accent-600/700` para cumplir 4,5:1 en texto y enlaces. Un test lee `main.css` y lo verifica, además del 6:1 del botón primario.
- **Scrim del modal.** Usa `bg-black/60`: `background-950` es el color más claro en tema oscuro y aclaraba la página. Es el único color fijo fuera de los estados.
- **`MarkdownView` restituye listas, tablas y citas.** El preflight de Tailwind les quita viñetas, numeración y bordes; se definen `ul`, `ol`, `blockquote`, `table`, `th` y `td` con clases de la paleta.
- **Fondo negro en tema oscuro.** Tras ver la paleta turquesa, Lucas pidió un fondo negro. La escala `background` del tema oscuro pasa a gris neutro sin tinte (`background-50` es `0 0 0`; las tarjetas usan `background-100`, `15 15 15`), y los verdes quedan como color de énfasis (botón primario, enlaces, foco). El tema claro conserva su fondo con tinte turquesa. Los tests de contraste siguen pasando (texto 16,5:1 y enlaces 11,7:1 sobre las tarjetas oscuras).

## ATAL-14

- **`z.record` con dos argumentos.** La historia escribe `z.record(z.unknown())`, que en zod 4 no existe. Se usa `z.record(z.string(), z.unknown())`, equivalente.
- **Owner y name sin distinguir mayúsculas.** Se guardan tal cual los escribe el usuario, pero el alta (409 `REPO_EXISTS`) y la ruta interna comparan con `COLLATE NOCASE`, porque GitHub no distingue mayúsculas y el `UNIQUE(owner, name)` de la migración sí. La migración queda idéntica a la de la historia.
- **Formato de owner y name.** `POST /api/repos` valida con el patrón de GitHub: owner de letras, números y guiones (hasta 39, sin empezar con guion); name de letras, números, `.`, `_` y `-` (hasta 100, y no `.` ni `..`). La misma validación protege la ruta interna.
- **Forma de las respuestas.** `Repo` es `{ id, owner, name, config, createdAt, updatedAt }` (fechas tal como las guarda SQLite, en UTC). `GET /api/repos` devuelve `{ repos: Repo[] }` con la config parseada; la ruta interna devuelve el mismo `Repo`. Los schemas viven en `packages/contracts/src/repoConfig.ts`.
- **Códigos HTTP no fijados por la historia.** Crear responde 201; borrar, 204; un id inexistente, 404 `REPO_NOT_FOUND`; un id que no es entero positivo, 400 `VALIDATION_ERROR`.
- **Ruta interna sin CORS.** El gateway tiene CORS, pero la historia pide que `/internal/repos/*` no lo tenga. El plugin de CORS se registra solo en el contexto de `/api`, y la ruta interna vive en otro contexto con su propio chequeo de token. Un test verifica que no devuelve `access-control-*` ni a un origen permitido.
- **`requireInternalToken` en core.** La comparación del token (hash SHA-256 y `timingSafeEqual`) se extrae de `createServiceApp` a `requireInternalToken(app, token)`, para que el gateway la reutilice en su ruta interna sin duplicarla. `createServiceApp` se comporta igual.
- **Config guardada inválida.** Al leer (detalle, lista o ruta interna) se hace `RepoConfig.parse`; si falla, 500 `INVALID_STORED_CONFIG` con el repo y los campos que fallan, sin repararla. Un solo repo corrupto hace fallar también la lista.
- **`buildApp` recibe `db`.** El gateway ya abría la base en `index.ts`; ahora se la pasa a `buildApp`. Los tests usan una base en memoria con las migraciones reales (`gateway/src/test-db.ts`).
- **Fuera de alcance.** Verificar que el repo exista en GitHub (ATAL-16), validar los `settings` de cada herramienta (ATAL-18) y la interfaz web.
