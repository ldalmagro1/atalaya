# Visión y no-objetivos

Nov 21, 2026 · @Lucas · v0.3

> **Cambios de la v0.3:** el MVP pasa a ser gateway + núcleo + agente revisor de pull requests (antes: linter y forecast); la arquitectura es un servicio por herramienta con un gateway (ADR-001); las revisiones con IA se hacen vía MCP (ADR-002). El linter, el forecast y la línea de comandos pasan a la segunda etapa.

*Para qué:* acordar qué problema resuelve la plataforma y qué queda afuera. *Para quién:* Lucas y cualquier persona que se sume al proyecto.

## Problema

Los equipos de software gestionan su trabajo en plataformas como Jira o Linear, pero esas plataformas no avisan si una historia está mal escrita, si el sprint va a cerrar, qué requerimientos quedaron sin pruebas ni qué cambia una pull request en la arquitectura. Cada equipo termina armando vistas y scripts propios, atados a un proyecto y a un gestor de tareas.

Afecta a equipos chicos y medianos sin un rol de gestión dedicado, y a quienes cumplen ese rol además de desarrollar.

## Usuarios objetivo

| Perfil | Cómo resuelve hoy el problema |
|---|---|
| Líder técnico o PM de un equipo chico | Revisa el tablero a mano, estima por intuición y arma planillas o vistas propias. |
| Desarrollador que revisa pull requests | Revisa el diff con poco contexto del resto del sistema. |
| Estudiante o equipo académico | Arma la trazabilidad de requerimientos a mano para cada entrega. |

## Propuesta de valor

Un panel de administración sobre las plataformas que el equipo ya usa: trae sus datos tal cual están, los traduce a un modelo neutral y agrega herramientas que esas plataformas no ofrecen.

Para el usuario cambia pasar de la intuición a la evidencia (una probabilidad de cierre en lugar de una corazonada, huecos de trazabilidad en lugar de una revisión manual), sin migrar de gestor de tareas y sin que nada se modifique sin su confirmación explícita.

## Alcance del MVP

- Gateway como único punto de entrada, base de datos compartida y plantilla de servicio para las herramientas (ADR-001 y ADR-003).
- Núcleo compartido: configuración por repositorio, `RepoProvider` para GitHub con caché local, manejo de errores y registro de herramientas.
- Agente revisor de pull requests como primera herramienta: la revisión la hace Claude desde la sesión del usuario a través del servidor MCP del gateway (ADR-002); los hallazgos quedan como borrador y se publican en GitHub solo desde la web, con vista previa y confirmación.
- Interfaz web local con tema claro y oscuro.

El resto de las herramientas (linter de user stories, forecast de sprint, matriz de trazabilidad, visualizador de dependencias y mapa del sprint) y el adaptador de Jira se construyen después, cada una como un servicio nuevo sobre la misma base. La línea de comandos unificada y los adaptadores de LLM por API quedan registrados en el documento de alcances para una segunda etapa.

## No-objetivos

Lo que queda afuera y vale la pena retomar se registra en el documento de alcances para una segunda etapa.

- **Ser un gestor de tareas propio.** La plataforma lee y analiza lo que vive en Jira, Linear u otros.
- **Administración avanzada de organizaciones.** Facturación, inicio de sesión corporativo y roles personalizados; la primera versión tiene organizaciones y equipos simples.
- **Análisis de código en lenguajes distintos de TypeScript, JavaScript y Python.**
  - Aparece en el visualizador de dependencias (Herramienta 4), que lee los `import` y `require` mediante análisis sintáctico (AST) y necesita un analizador por lenguaje. La primera versión trae solo los tres mencionados; sumar otro es escribir un analizador nuevo, sin tocar el resto.
  - Alcanza también al agente revisor de pull requests, que usa el mapa de dependencias para medir el impacto de un cambio: en repositorios con otros lenguajes ese análisis de impacto no estará disponible.
  - No afecta al linter, al forecast, al mapa del sprint ni a la matriz de trazabilidad, que trabajan con issues, commits e identificadores y no interpretan el código.
- **Modificar Jira, GitHub o un repositorio sin que el usuario lo pida.** Las herramientas leen los datos por su cuenta, pero toda escritura (crear o editar un issue, mover una historia, publicar un comentario de revisión, tocar documentación del repositorio) es una acción explícita del usuario: primero se muestra una vista previa de qué va a cambiar y recién después de confirmarlo se aplica. Las escrituras en un repositorio van siempre a una rama aparte o como comentario, nunca sobre la rama principal.
- **Revisiones o acciones del agente sin pedido.** El agente revisor de pull requests nunca se dispara solo, no aprueba ni fusiona pull requests y no ejecuta el código de la pull request.
- **Otros proveedores de tareas dentro del MVP.** Jira, Linear y GitHub Issues se suman después, con la misma interfaz, cuando arranque la primera herramienta que lea tareas.
- **Llamar a un modelo de lenguaje por API desde la plataforma.** En el MVP la IA la aporta Claude desde la sesión del usuario vía MCP (ADR-002); los adaptadores por API se registran para la segunda etapa.

## Métricas de éxito

1. *(Propuesta a confirmar; reemplaza la métrica anterior sobre linter y forecast.)* Al 31/12/2026, el agente revisor produjo y publicó en GitHub, con vista previa y confirmación, revisiones de al menos 3 pull requests reales de la propia plataforma, sin que ninguna publicación se haya hecho sin confirmación explícita.
2. Al 31/12/2026, cada servicio y paquete del MVP tiene pruebas unitarias con cobertura de al menos 80 %, y el acceso a GitHub se prueba contra respuestas grabadas y anonimizadas, sin depender de la red.
   - *Respuestas grabadas:* se guardan como archivos copias de respuestas de la API de GitHub (pull requests, archivos, revisiones) y las pruebas leen esos archivos en lugar de consultar GitHub. Como el repositorio es público, deben estar anonimizadas.
   - *Por qué:* las pruebas son rápidas, dan el mismo resultado cada vez, corren sin conexión ni credenciales y no se rompen si GitHub cambia o está caído. Además es lo que permite correr las pruebas en CI sin exponer un token.

## Criterio para pivotar o abandonar

- **Pivotar:** si al sumar el segundo proveedor (Linear) hay que modificar las herramientas y no solo escribir un adaptador, el modelo neutral no cumple su función. En ese caso el cambio no se resuelve dentro de esta etapa: se deja para una **segunda etapa del proyecto**, que se trata como un proyecto nuevo y requiere su propia documentación, basada en el estado de la plataforma en ese momento más lo necesario para el pivote.
- **Abandonar:** si tras dos rediseños del modelo neutral las herramientas siguen siendo más simples sobre un solo proveedor, el producto pasa a ser un conjunto de herramientas por proveedor. Ese replanteo también se encara como una segunda etapa, con documentación nueva.
