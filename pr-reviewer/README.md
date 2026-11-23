# pr-reviewer

Primera herramienta de Atalaya: lee pull requests de GitHub y ayuda a revisarlos con Claude. Es un servicio propio (puerto `3101`) que el gateway enruta en `/api/tools/pr-reviewer/*`.

Hoy solo trae la base del servicio: `GET /internal/health` y `GET /internal/manifest`, creados con `createServiceApp` de `@atalaya/core`. La lógica de revisión llega en las historias del épico.

## Configuración

`src/config.ts` lee y valida, una sola vez, estas variables del `.env` de la raíz (ver `.env.example`):

| Variable           | Qué es                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `PR_REVIEWER_PORT` | Puerto local del servicio (`3101`).                                                        |
| `INTERNAL_TOKEN`   | Secreto de 32 caracteres o más; todo pedido debe traerlo en `X-Atalaya-Internal-Token`.    |
| `DB_PATH`          | Base SQLite compartida (`./data/atalaya.db`); una ruta relativa parte de la raíz del repo. |

Requiere Node 20.12 o superior (usa `process.loadEnvFile`).

## Base de datos

Las tablas de esta herramienta llevan el prefijo `prreviewer_` y sus migraciones viven en `db/migrations/` (`NNN_nombre.sql`). Al arrancar, `runMigrations` aplica las pendientes y rechaza cualquier objeto fuera del prefijo o clave foránea hacia otro servicio (ADR-003).

## Cómo correrlo

```bash
npm run dev -w @atalaya/pr-reviewer     # solo este servicio
npm run dev                             # toda la plataforma
curl -H "X-Atalaya-Internal-Token: $INTERNAL_TOKEN" http://127.0.0.1:3101/internal/health
```
