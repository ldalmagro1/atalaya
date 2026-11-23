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
