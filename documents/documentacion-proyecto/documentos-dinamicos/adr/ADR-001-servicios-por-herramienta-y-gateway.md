# ADR-001 · Una carpeta y un servicio por herramienta, con un gateway delante

Nov 21, 2026 · @Lucas · v0.1

*Estado:* Aceptada. *Reemplaza:* la sección "Estructura de paquetes" y el diagrama de arquitectura de la descripción inicial del proyecto (monorepo con `packages/` y un solo servidor).

## Contexto

La plataforma va a tener seis herramientas (linter de historias, forecast, matriz de trazabilidad, dependencias, mapa del sprint y agente revisor de pull requests). Las desarrolla una sola persona, una a la vez, y deben poder construirse, probarse y documentarse sin tocar las demás. También tienen que integrarse: el mapa del sprint muestra el resultado del linter y del forecast, y el agente revisor usa el mapa de dependencias.

## Alternativas

Criterios: aislamiento del desarrollo de cada herramienta, complejidad operativa para una persona, credenciales con el menor privilegio posible, costo de sumar una herramienta y riesgo sobre el plazo del MVP (31/12/2026).

| Alternativa | Aislamiento | Complejidad | Credenciales | Sumar herramienta | Plazo |
|---|---|---|---|---|---|
| A. Un servidor y un paquete por herramienta (diseño original) | Bajo: comparten proceso | Baja | Todas en un proceso | Registrar un paquete | Bajo riesgo |
| B. Monolito modular: carpeta por herramienta, un proceso, el gateway las monta como plugins | Medio: límites por convención | Baja | Todas en un proceso | Carpeta y registro | Bajo riesgo |
| **C. Un servicio por herramienta (proceso, puerto y tablas propios) y un gateway** | **Alto** | **Media** | **Cada servicio lee solo las suyas** | **Carpeta, plantilla y registro** | **Riesgo medio** |
| D. Como C, con una base por servicio y un servicio "core" | Muy alto | Alta | Cada servicio las suyas | Igual que C, más contratos | Riesgo alto |

## Decisión

Se adopta la alternativa **C**.

```
atalaya/
├─ gateway/          @atalaya/gateway       127.0.0.1:3001  único punto de entrada
├─ web/              @atalaya/web           127.0.0.1:5173  una sola app, una carpeta por herramienta
├─ pr-reviewer/      @atalaya/pr-reviewer   127.0.0.1:3101  herramienta 1
├─ <otra-herramienta>/                      127.0.0.1:31xx  se crea cuando arranca su épico
├─ packages/
│  ├─ contracts/     @atalaya/contracts     schemas zod y tipos compartidos
│  └─ core/          @atalaya/core          librería: acceso a la base, migraciones, errores, RepoProvider
└─ documents/
```

1. **Cada herramienta es un servicio independiente**: su carpeta en la raíz, su proceso, su puerto, sus tablas, sus tests y su README. Solo se crea la carpeta de una herramienta cuando empieza su épico.
2. **El gateway es lo único que ve la web.** Enruta `/api/tools/:toolId/*` al servicio correspondiente, agrega la salud de todos, es dueño de la configuración (repositorios, conexiones, herramientas habilitadas) y expone el servidor MCP (ADR-002).
3. **Los servicios no se importan entre sí.** Se comunican por HTTP a través del gateway, con los tipos de `@atalaya/contracts`. `@atalaya/core` y `@atalaya/contracts` son **librerías**, no servicios.
4. **Seguridad entre procesos.** Todo escucha solo en `127.0.0.1`. Los servicios no tienen CORS y rechazan cualquier pedido que no traiga el encabezado `X-Atalaya-Internal-Token` con el valor de `INTERNAL_TOKEN` (secreto aleatorio del `.env`). El CORS solo existe en el gateway, para `http://127.0.0.1:5173` y `http://localhost:5173`.
5. **Credenciales por servicio.** Cada servicio tiene su `config.ts`, que lee y valida únicamente las variables que necesita (por ejemplo, `JIRA_*` solo lo lee la herramienta que usa Jira).
6. **Contrato de servicio.** Todo servicio expone `GET /internal/health` y `GET /internal/manifest` (`id`, `name`, `description`, `version`) y se registra en la lista de herramientas del gateway.
7. `npm run dev` levanta gateway, web y todos los servicios existentes.

## Consecuencias

- (+) Se puede desarrollar, probar y documentar cada herramienta sin tocar las otras.
- (+) Una herramienta con una falla o un permiso de más no expone las credenciales de las demás.
- (+) Sumar una herramienta es copiar la plantilla de servicio y registrarla.
- (−) Hay más procesos, más puertos y más contratos que mantener que en un solo servidor.
- (−) Las integraciones entre herramientas pasan por HTTP y necesitan contratos explícitos.
- (−) El trabajo de base (gateway, plantilla de servicio, contratos) entra antes de la primera herramienta. Se mitiga con historias chicas y la plantilla reutilizable.
- (−) Si más adelante se publica fuera de la máquina local, hay que sumar autenticación y HTTPS en el gateway (ver ATAL-26 y SE-006).
