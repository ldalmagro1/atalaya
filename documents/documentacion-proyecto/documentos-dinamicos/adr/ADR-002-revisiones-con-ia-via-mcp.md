# ADR-002 · Las revisiones con IA se hacen vía MCP con la cuenta de Claude del usuario

Nov 21, 2026 · @Lucas · v0.1

*Estado:* Aceptada, con verificaciones pendientes (ver el final). *Reemplaza:* la decisión abierta "Modelo de IA y proveedor para el agente y las capas opcionales" y el diseño de capa `LlmProvider` con adaptadores de Gemini y Anthropic.

## Contexto

El agente revisor necesita un modelo de lenguaje. El diseño original lo llamaba desde el servidor con una API key (Gemini por defecto, Anthropic opcional), lo que implica credenciales de LLM en el `.env`, costo por uso y una capa de adaptadores. El usuario ya tiene un plan de Claude y quiere usarlo para las revisiones.

Un servidor MCP no llama a un modelo: es el cliente de Claude (Claude Code, con la sesión iniciada con la cuenta del usuario) quien llama a las herramientas del servidor. El modelo corre del lado del cliente y su consumo cuenta contra esa sesión.

## Alternativas

| Alternativa | Credenciales de LLM en Atalaya | Costo | Botón "Revisar" en la web | Esfuerzo |
|---|---|---|---|---|
| A. Adaptadores por API (Gemini y Anthropic), como estaba | Sí | Por uso | Sí | Alto (`LlmProvider`, reintentos, catálogo, mock) |
| **B. Atalaya expone un servidor MCP y Claude hace la revisión en la sesión del usuario** | **No** | **Incluido en el plan del usuario (a verificar)** | **No: se pide desde Claude** | **Medio** |
| C. El backend lanza `claude` en modo no interactivo con la suscripción | No | Plan del usuario | Sí | Medio, pero no se verificó que los términos de uso lo permitan |

## Decisión

Se adopta la alternativa **B**. La alternativa A queda registrada como alcance futuro (SE-005) y la C no se adopta mientras no se verifiquen los términos de uso.

1. **El gateway expone el servidor MCP.** Agrega las herramientas MCP que declara cada servicio. Se registra una sola vez en Claude Code (`claude mcp add --scope user --transport stdio atalaya -- <comando>`).
2. **Flujo del revisor.** El usuario pide en Claude Code "revisá el PR N de owner/nombre con Atalaya". Claude llama a una herramienta de lectura que devuelve el diff anotado con números de línea y el contexto del repositorio, razona y entrega los hallazgos a una herramienta que los guarda como **borrador**. El informe se ve en la web de Atalaya.
3. **Publicar no es una herramienta MCP.** Publicar en GitHub se hace solo desde la interfaz web, con vista previa y confirmación explícita. Las herramientas MCP son de solo lectura, salvo la que guarda el borrador local.
4. **Las instrucciones de revisión** (el prompt del sistema) se publican como un prompt MCP, para que el usuario las vea y las edite.
5. **Los hallazgos que llegan de Claude se validan con zod** antes de guardarse, igual que antes se validaba la salida del modelo.
6. **El contenido del pull request sigue siendo dato no confiable.** Se entrega marcado como tal y nunca se obedece como instrucción. Como la sesión del usuario puede tener otras herramientas, la defensa principal es la regla 3: ninguna herramienta MCP de Atalaya puede publicar ni modificar nada fuera del borrador local.
7. **El límite de entrada** (`MAX_INPUT_CHARS`) se aplica a lo que devuelve la herramienta de lectura: un PR grande consume el cupo del plan del usuario y no se trunca en silencio.

## Consecuencias

- (+) No hay API keys de LLM, ni costo por uso, ni adaptadores. Se eliminan ATAL-23 y ATAL-24 y se rehace ATAL-8.
- (+) Refuerza la regla "nada se dispara solo": la revisión empieza siempre con un pedido explícito del usuario en su sesión.
- (−) Solo se puede revisar con una sesión de Claude abierta. No hay revisión desde un botón de la web ni sin supervisión.
- (−) Cada revisión consume el cupo del plan del usuario.
- (−) Una sesión con varias herramientas aumenta la superficie de prompt injection. Se mitiga con la regla 3.
- (−) La calidad ya no se compara entre proveedores: depende del modelo que tenga la sesión del usuario.

## Verificaciones pendientes

- Confirmar con `/status` y `/usage` en Claude Code que el consumo de la sesión iniciada con la cuenta del usuario cuenta contra su plan (la página de MCP de la documentación no lo indica).
- Confirmar si Claude Desktop o claude.ai pueden conectarse a un servidor MCP local. Hoy el camino documentado y verificado es Claude Code.
- Leer los términos de uso antes de considerar la alternativa C.
