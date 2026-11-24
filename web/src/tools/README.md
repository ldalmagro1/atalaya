# Herramientas de la web

Hay una sola app web para todas las herramientas de Atalaya. El código de cada herramienta vive
en su propia carpeta: `web/src/tools/<toolId>/` (por ejemplo `web/src/tools/pr-reviewer/`).

## Regla de aislamiento

- Una herramienta **no importa** de la carpeta de otra (`tools/a/` no importa de `tools/b/`).
  ESLint lo hace cumplir con `no-restricted-imports`.
- Lo que comparten varias herramientas va en `web/src/components/` (componentes), `web/src/hooks/`,
  `web/src/api/` o `web/src/theme/`, no en la carpeta de una de ellas.
- Una herramienta habla solo con el gateway, por rutas relativas `/api/tools/<toolId>/...`, usando
  los tipos de `@atalaya/contracts`. Nunca llama a un puerto de servicio directamente.
- La carpeta de una herramienta se crea cuando empieza su épico, no antes.
