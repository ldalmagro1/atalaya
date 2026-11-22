# Alcances y requerimientos para una segunda etapa

Nov 6, 2026 · @Lucas · v0.1

*Para qué:* registrar las funciones que quedan fuera del alcance actual y podrían sumarse en una nueva versión, sin perderlas y sin que se cuelen en un sprint. *Para quién:* Lucas y quien evalúe el proyecto; es la base de la documentación de la segunda etapa.

Es un documento **vivo**: se alimenta durante todo el desarrollo y se revisa en el refinamiento de cada sprint y al cerrar el proyecto.

## Reglas de uso

- Cada idea fuera de alcance se registra con el formato de la sección siguiente, sin saltear campos. Lo que no se sabe todavía se completa con "Sin evaluar".
- Registrar una entrada **no** la compromete: no entra a un sprint ni al backlog hasta que su estado sea "Aceptada para la segunda etapa".
- Las entradas no se borran. Si una idea se descarta o se incorpora, cambia de estado y queda el motivo.
- Los IDs son correlativos y no se reutilizan (SE-001, SE-002, ...).
- Si una entrada se vuelve imprescindible para cumplir el MVP, deja de ser un alcance futuro: se la incorpora al backlog, se actualiza la Visión y la entrada pasa a "Incorporada".

## Formato de entrada

Cada entrada es un bloque con estos campos, en este orden:

```
### SE-000 · Título (verbo + objeto)

- Estado: Propuesta | Evaluada | Aceptada para la segunda etapa | Descartada | Incorporada
- Fecha de alta: AAAA-MM-DD
- Origen: dónde apareció (no-objetivo de la Visión, sprint N, retrospectiva, pedido de un usuario)
- Herramienta o área: core | proveedores | linter | forecast | matriz | dependencias | mapa del sprint | agente revisor | verificador E2E | CLI | transversal
- Descripción: qué es y qué problema resuelve, en 2 o 3 oraciones
- Por qué quedó afuera: motivo concreto (costo, dependencia, no valida el MVP, decisión de alcance)
- Valor: Alto | Medio | Bajo | Sin evaluar — con una línea de justificación
- Esfuerzo: S | M | L | Sin evaluar
- Prioridad: P1 | P2 | P3 | Sin evaluar (derivada de valor y esfuerzo)
- Dependencias: otras entradas (SE-xxx) o decisiones necesarias; "Ninguna" si no hay
- Historial: fecha y cambio de estado, valor o prioridad
```

## Criterios de valor, esfuerzo y prioridad

**Valor** (qué aporta si se construye):

| Nivel | Criterio |
|---|---|
| Alto | Habilita un caso de uso completo, o elimina una limitación que impide usar la plataforma en otro proyecto o equipo. |
| Medio | Mejora de forma notable una herramienta existente o reduce trabajo manual frecuente. |
| Bajo | Comodidad o pulido; el usuario puede vivir sin esto sin perder capacidad. |

**Esfuerzo** (tiempo orientativo de una persona):

| Nivel | Criterio |
|---|---|
| S | Hasta 1 sprint de trabajo parcial, sin cambios en el núcleo. |
| M | Hasta 1 sprint completo, o un cambio acotado en el núcleo. |
| L | Más de 1 sprint, o un cambio de diseño que afecta a varias herramientas. |

**Prioridad** (se deriva, no se elige):

| | Esfuerzo S | Esfuerzo M | Esfuerzo L |
|---|---|---|---|
| **Valor Alto** | P1 | P1 | P2 |
| **Valor Medio** | P2 | P2 | P3 |
| **Valor Bajo** | P3 | P3 | P3 |

P1 se encara primero en la segunda etapa, P2 después y P3 solo si sobra capacidad. Las entradas "Sin evaluar" no tienen prioridad.

## Índice

| ID | Título | Herramienta o área | Valor | Esfuerzo | Prioridad | Estado |
|---|---|---|---|---|---|---|
| SE-001 | Sumar LinearProvider | proveedores | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-002 | Sumar analizadores de código para otros lenguajes | dependencias | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-003 | Administración avanzada de organizaciones | core | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-004 | Verificación en dos pasos propia de la plataforma | transversal | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-005 | Sumar adaptadores de LLM por API (Gemini y Anthropic) | agente revisor | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-006 | Desplegar la plataforma fuera de la máquina local | transversal | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-007 | Línea de comandos unificada como cliente del gateway | CLI | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-008 | Construir el linter de historias y el forecast de sprint | linter | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |
| SE-009 | Construir el verificador de aceptación de punta a punta | verificador E2E | Sin evaluar | Sin evaluar | Sin evaluar | Propuesta |

## Entradas

### SE-001 · Sumar LinearProvider

- Estado: Propuesta
- Fecha de alta: 2026-11-06
- Origen: no-objetivo de la Visión (otros proveedores de tareas fuera del MVP)
- Herramienta o área: proveedores
- Descripción: segundo adaptador de tareas, con la misma interfaz que JiraProvider, para usar la plataforma con equipos que trabajan en Linear. Es además la prueba de que el modelo neutral no depende de Jira.
- Por qué quedó afuera: el MVP se valida con un solo proveedor sobre el backlog propio.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: ninguna. Si requiere modificar las herramientas, aplica el criterio de pivote de la Visión.
- Historial: 2026-11-06 · alta

### SE-002 · Sumar analizadores de código para otros lenguajes

- Estado: Propuesta
- Fecha de alta: 2026-11-06
- Origen: no-objetivo de la Visión (análisis de código solo en TypeScript, JavaScript y Python)
- Herramienta o área: dependencias
- Descripción: un analizador sintáctico por lenguaje nuevo para el visualizador de dependencias. También habilita el análisis de impacto del agente revisor de pull requests en repositorios con esos lenguajes.
- Por qué quedó afuera: cada lenguaje requiere su propio analizador y el MVP ni siquiera incluye el visualizador.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: visualizador de dependencias construido.
- Historial: 2026-11-06 · alta

### SE-003 · Administración avanzada de organizaciones

- Estado: Propuesta
- Fecha de alta: 2026-11-06
- Origen: no-objetivo de la Visión (administración avanzada de organizaciones)
- Herramienta o área: core
- Descripción: facturación, inicio de sesión corporativo y roles personalizados dentro de una organización. Incluye definir quién crea equipos, quién conecta tableros y quién puede escribir en el backlog.
- Por qué quedó afuera: la primera versión tiene organizaciones y equipos simples.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: decisión abierta sobre dónde viven las organizaciones, los equipos y sus datos.
- Historial: 2026-11-06 · alta

### SE-004 · Verificación en dos pasos propia de la plataforma

- Estado: Propuesta
- Fecha de alta: 2026-11-06
- Origen: alcance transversal de la descripción inicial (inicio de sesión: "en una segunda etapa")
- Herramienta o área: transversal
- Descripción: segundo factor de autenticación propio de la plataforma, por ejemplo códigos de una aplicación autenticadora, que se suma al inicio de sesión con GitHub de las aplicaciones web. También sirve como ejercicio de implementación.
- Por qué quedó afuera: el MVP no incluye aplicaciones web, y el método y cuándo se exige están como decisiones abiertas.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: aplicaciones web con inicio de sesión con GitHub.
- Historial: 2026-11-06 · alta

### SE-005 · Sumar adaptadores de LLM por API (Gemini y Anthropic)

- Estado: Propuesta
- Fecha de alta: 2026-11-21
- Origen: ADR-002 (las revisiones del MVP se hacen vía MCP con la cuenta de Claude del usuario)
- Herramienta o área: agente revisor
- Descripción: interfaz `LlmProvider` con adaptadores de Gemini y Anthropic, proveedor simulado para pruebas, reintentos y catálogo de modelos. Permitiría un botón "Revisar" en la web y revisiones sin una sesión de Claude abierta, a cambio de API keys y costo por uso.
- Por qué quedó afuera: el MVP usa el plan de Claude del usuario vía MCP y evita credenciales de LLM y costo por uso.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: agente revisor construido. Tomar como punto de partida las historias ATAL-23 y ATAL-24 del backlog.
- Historial: 2026-11-21 · alta

### SE-006 · Desplegar la plataforma fuera de la máquina local

- Estado: Propuesta
- Fecha de alta: 2026-11-21
- Origen: historia ATAL-26 (discovery de hosting) y dominio propio disponible (subdominio previsto `atalaya-dev` en Cloudflare)
- Herramienta o área: transversal
- Descripción: publicar el gateway, la web y los servicios en un host accesible por internet, con HTTPS, autenticación delante del gateway, secretos gestionados por la plataforma, disco persistente para la base y un MCP remoto para Claude Code.
- Por qué quedó afuera: el diseño del MVP es local (todo en `127.0.0.1`, sin inicio de sesión). El resultado del discovery de ATAL-26 define si se encara y cómo.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: ATAL-26, SE-004 y la restricción de ADR-003 (todos los servicios en el mismo host o volumen).
- Historial: 2026-11-21 · alta

### SE-007 · Línea de comandos unificada como cliente del gateway

- Estado: Propuesta
- Fecha de alta: 2026-11-21
- Origen: alcance transversal de la descripción inicial; sale del MVP en la v0.3 de la Visión
- Herramienta o área: CLI
- Descripción: un único punto de entrada con un subcomando por herramienta, más comandos para configurar y verificar conexiones. Hablaría con el gateway por HTTP en lugar de importar el código de las herramientas.
- Por qué quedó afuera: el MVP tiene una sola herramienta y su interfaz es la web más MCP.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: gateway con API estable y al menos dos herramientas.
- Historial: 2026-11-21 · alta

### SE-008 · Construir el linter de historias y el forecast de sprint

- Estado: Propuesta
- Fecha de alta: 2026-11-21
- Origen: Visión v0.2 (eran el MVP); se pospusieron en la v0.3 para empezar por el agente revisor
- Herramienta o área: linter
- Descripción: las herramientas 1 y 2 de la descripción inicial, cada una como un servicio nuevo. Requieren el adaptador de Jira (`JiraProvider`) sobre el backlog real de la plataforma.
- Por qué quedó afuera: el MVP se acotó al agente revisor y a la base (gateway y servicios) que lo sostiene.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: ADR-001, plantilla de servicio y adaptador de Jira (ATAL-17 como punto de partida).
- Historial: 2026-11-21 · alta

### SE-009 · Construir el verificador de aceptación de punta a punta

- Estado: Propuesta
- Fecha de alta: 2026-11-22
- Origen: ATAL-22 (conversación sobre qué probar más allá del CI por PR)
- Herramienta o área: verificador E2E
- Descripción: una herramienta nueva que toma los criterios de aceptación de una historia y los prueba contra la aplicación corriendo, recorriendo los flujos reales en un navegador. Tiene dos niveles: pruebas E2E determinísticas con Playwright (con datos falsos y sin red) y, encima, un agente con navegador, conectado por MCP, que explora la app guiado por los criterios y reporta fallas. Se ejecutaría bajo pedido, por calendario o cada N fusiones a `main`, no en cada PR. Cada criterio quedaría ligado a su prueba, lo que alimenta la matriz de trazabilidad.
- Por qué quedó afuera: hoy gateway, web y `pr-reviewer` son placeholders y no hay flujos que probar. El agente tiene costo por uso, no es determinístico y exige controlar los falsos positivos; conviene un discovery antes de comprometerlo. Una máquina virtual efímera para correrlo es un paso posterior.
- Valor: Sin evaluar
- Esfuerzo: Sin evaluar
- Prioridad: Sin evaluar
- Dependencias: primer flujo real de la web (revisor de pull requests), ADR-001 y ADR-002; se refina cuando se trabaje esta herramienta.
- Historial: 2026-11-22 · alta
