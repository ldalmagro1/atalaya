---
description: Inicia una historia de usuario - crea la rama, lee la US en Jira y propone un plan con preguntas
argument-hint: <ATAL-XX | número>
allowed-tools: Bash(git status:*), Bash(git branch --show-current), Bash(git branch --merged main), Bash(git branch -vv), Bash(git branch -a --list:*), Bash(git branch -d:*), Bash(git worktree list:*), Bash(git rev-parse --show-toplevel), Bash(node scripts/enlaces-externos.mjs:*), Bash(git checkout:*), Bash(git switch:*), Bash(git fetch:*), Bash(git pull --ff-only:*), Bash(git log:*), mcp__claude_ai_Atlassian_MCP__*
---

Vas a arrancar el desarrollo de la historia de usuario `$ARGUMENTS`. Responde siempre en español.

**Regla: no uses subagentes.** Haz todo directamente en esta sesión con tus propias herramientas (no uses la herramienta `Agent` ni delegues la lectura de Jira, la exploración del repo ni la planificación).

## 1. Normalizar la clave

- Si el argumento es solo un número (`12`), la clave es `ATAL-12`. Si ya viene como `ATAL-12`, úsala tal cual.
- Si no hay argumento, pídelo y detente.

## 2. Leer la US en Jira (antes de tocar git)

- Obtén el `cloudId` con `getAccessibleAtlassianResources` (una sola vez).
- Lee la historia con `getJiraIssue` (vista completa) y sus comentarios con `listJiraIssueComments`.
- Si hay historias vinculadas (bloqueos, padre/épica, relacionadas), léelas también con `getJiraIssue`, solo lo necesario para entender el contexto.
- Si la historia no existe o no hay acceso, informa el error y detente sin crear la rama.

## 3. Crear la rama

1. Verifica `git status`. Si el árbol de trabajo tiene cambios sin commitear, avisa y pregunta cómo seguir; no los descartes.
2. Arma el nombre: `ATAL-XX-titulo-de-la-us`, donde el título es el resumen de la historia en minúsculas, sin tildes ni signos, con guiones en lugar de espacios, máximo ~50 caracteres cortando en límite de palabra.
3. Cambia a `main` (`git switch main`) y actualízala con `git pull --ff-only origin main`, por si hubo cambios desde otra computadora. Si el pull falla (divergencia, conflictos), informa el error y detente sin crear la rama.
4. Limpia las ramas locales ya fusionadas, como indica la sección **Limpieza de ramas y worktrees** (abajo). Si falla, informa el error y sigue.
5. Desde `main` ya actualizada, crea la rama: `git switch -c <rama>`.
6. Si la rama ya existe (local o remota), no la recrees: pregunta si cambiar a ella o usar otro nombre.
7. No hagas push ni commits.

### Limpieza de ramas y worktrees

Se hace después del `git pull` y antes de crear la rama nueva. **No bloquea la historia:** si cualquier comando falla o Git rechaza un borrado, informa el error, no lo fuerces y continúa.

1. Ejecuta `git fetch --prune origin`, para que las ramas remotas ya borradas dejen de figurar.
2. Las candidatas son las ramas de `git branch --merged main` (los prefijos `*` y `+` no son parte del nombre). Nunca entran `main`, la rama actual ni la rama que se va a crear.
3. Con `git branch -vv`, informa las ramas cuya remota figura como `gone` pero que no están fusionadas en `main`. **Se conservan.**
4. Con `git worktree list --porcelain`, identifica las candidatas que tienen un worktree. Se conservan, el worktree y la rama, e informas la ruta y el motivo si el worktree:
   - es el principal (el primero de la lista) o aquel desde el que corre la sesión (`git rev-parse --show-toplevel`);
   - figura como `locked`;
   - tiene cambios sin commitear o archivos sin seguimiento (`git -C <ruta> status --porcelain` devuelve algo);
   - tiene enlaces que apuntan fuera de él: `node scripts/enlaces-externos.mjs <ruta>` no termina con código 0. En Windows, `git worktree remove` sigue esos enlaces y **borra los archivos del destino**. Si el script falla o no existe, conserva el worktree.
5. Borrar un worktree también borra sus archivos ignorados. En cada worktree candidato revísalos con `git -C <ruta> status --porcelain --ignored` (líneas `!!`). Si hay algo que no sea generado (`node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.husky/_/`), por ejemplo `.env`, `data/` o configuración local, nómbralo en la pregunta para que se vea qué se perdería. No abras esos archivos.
6. Si no queda ninguna candidata, sigue sin preguntar. Si hay, muestra la lista (rama, ruta del worktree si tiene y avisos) y pregunta con `AskUserQuestion` si borrarlas todas, elegir cuáles o no borrar ninguna. Para elegir, usa selección múltiple si son hasta 4; si son más, pide los nombres en texto. **Sin confirmación no se borra nada.**
7. Por cada rama confirmada: si tiene worktree, `git worktree remove <ruta>`; solo si eso funcionó (o no tenía worktree), `git branch -d <rama>`.
8. Informa qué borraste, qué conservaste y por qué.

Prohibido en esta limpieza: `--force` o `-f`, `git branch -D`, borrar carpetas a mano y borrar ramas remotas (`git push --delete`).

## 4. Entender el contexto del repo

Antes de planificar, revisa lo mínimo necesario: `README.md`, `DECISIONES.md`, los ADR en `documents/documentacion-proyecto/documentos-dinamicos/adr/` y los paquetes/servicios que la historia toca (`gateway`, `web`, `pr-reviewer`, `packages/*`). Respeta las decisiones ya tomadas; si la US las contradice, señálalo.

## 5. Devolver el plan

Presenta, en este orden y sin escribir código todavía:

1. **Resumen de la US**: qué pide, en tus palabras, y los criterios de aceptación tal como figuran en Jira.
2. **Rama creada**: nombre y base.
3. **Plan de implementación**: pasos numerados y ordenados. Para cada uno, archivos/paquetes afectados y cómo se verifica (tests, `npm run build`, `lint`, `format:check`). Indica qué criterio de aceptación cubre cada paso.
4. **Riesgos y dependencias**: bloqueos, decisiones de ADR relacionadas, cosas fuera de alcance.
5. **Preguntas abiertas**: todo lo que sea ambiguo o falte en la historia y que cambie el plan. Hazlas con `AskUserQuestion` (opciones concretas con tu recomendación primero) cuando tengan respuestas acotadas; usa texto libre para el resto. No preguntes lo que puedes resolver leyendo el repo o con un criterio razonable (menciona esos supuestos en el plan).

## 6. Después de las respuestas

Con las respuestas del usuario, ajusta el plan y pide confirmación explícita antes de empezar a implementar. Cuando se implemente:

- **No crees commits sin autorización explícita del usuario.** Deja los cambios sin commitear y pregunta antes de cada commit.
- Cuando el usuario lo autorice, el mensaje lleva el prefijo `ATAL-XX: ` en español, como en el historial del repo, y **sin coautor**: no agregues `Co-Authored-By` ni ninguna otra línea de atribución a Claude.

Las decisiones que la historia no fije se registran en `DECISIONES.md`.
