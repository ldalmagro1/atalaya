# ADR-004 · Hosting local con Cloudflare Tunnel y Access, con escalones de escalado

Nov 23, 2026 · @Lucas · v0.1

*Estado:* Aceptada. *Depende de:* ADR-001, ADR-002 y ADR-003. *Origen:* ATAL-26 (discovery de hosting).

## Contexto

Se quiere abrir Atalaya desde cualquier computadora con `atalaya-dev.lucasdalmagro.com` (dominio con DNS en Cloudflare), sin gastar en hosting. ADR-003 exige un solo host o volumen con SQLite (WAL). La meta de largo plazo es multiusuario (login con GitHub, cada persona ve sus repos), pero se arranca con un solo usuario.

Se evaluaron: solo local, local con Tunnel y Access, host con disco (VPS o contenedor), frontend en Cloudflare con base gestionada, AWS y Vercel. Quedaron descartadas por costo o por no ofrecer disco persistente: Render, Koyeb, Fly.io, Railway, AWS (el free tier de cuentas nuevas vence), Cloudflare Workers/Pages/D1 y Vercel (funciones con sistema de archivos efímero, incompatibles con SQLite). El informe completo con fuentes y fecha está en el comentario de ATAL-26.

## Alternativas

| Alternativa | Costo | Disco persistente | Contradice ADR-003 |
|---|---|---|---|
| **A. Equipo propio con Tunnel y Access** | **$0** | **Sí** | **No** |
| **B. Otra computadora de casa, igual que A** | **$0** | **Sí** | **No** |
| **C. Google Cloud e2-micro (Always Free) con Tunnel y Access** | **$0 dentro del límite** | **Sí** | **No** |
| D. Frontend en Cloudflare y API con base gestionada | Variable | Sí | Sí |
| E. AWS, Fly.io, Railway, Render, Koyeb o Vercel | Pago o sin disco | Variable | Variable |

## Decisión

Se adoptan A, B y C como **escalones**, en ese orden:

1. **Escalón A (inicial):** Atalaya corre en la computadora de Lucas, encendida mientras se trabaja o se usa. `cloudflared` publica `atalaya-dev.lucasdalmagro.com` sin abrir puertos. Cloudflare Access pide login de GitHub y deja pasar solo al usuario de Lucas.
2. **Escalón B:** si la máquina actual se resiente, se pasa a otra computadora de la casa, con la misma instalación (túnel, `.env` y archivo de base movidos).
3. **Escalón C:** si no hay otra máquina disponible, Google Cloud e2-micro. Exige tarjeta de crédito, alertas de presupuesto desde el primer día, región de EE. UU. y disco estándar, y respeta el límite de salida de 1 GB al mes.
4. **Idea a muy largo plazo, sin compromiso:** una Raspberry Pi dedicada como host. No está en los planes de compra. Si algún día se evalúa, hay que verificar antes que `better-sqlite3` instale en ARM y medir si alcanza; no se verificó.
5. **Multiusuario:** fase posterior, fuera de esta decisión. Requiere login propio con GitHub App, tokens por usuario cifrados, datos y autorización por usuario y MCP remoto con identidad por usuario. Cambiaría la regla de tokens solo en `.env` y la de «un solo usuario» de ADR-003. Se encara con historias propias.

Reglas del escalón A:

- El gateway y los servicios siguen escuchando solo en `127.0.0.1`. Tunnel se conecta desde el mismo equipo.
- El gateway valida el JWT de la cabecera `Cf-Access-Jwt-Assertion` (firma con las claves de `<equipo>.cloudflareaccess.com/cdn-cgi/access/certs`, `iss`, `aud`, `exp`) y rechaza lo que no lo traiga. Su CORS suma `https://atalaya-dev.lucasdalmagro.com`.
- No se publica nada hasta que existan Tunnel, Access y la validación del JWT.
- El MCP sigue siendo local (stdio) por ahora. El MCP remoto se resuelve en una historia aparte: la ruta `/mcp` necesitaría una política propia en Access (Service Auth o Bypass) o autenticación en el gateway.
- Sin CD: el despliegue es manual (SE-006 queda fuera de alcance). `atalaya-dev` es el único ambiente.

## Consecuencias

- (+) Costo cero y sin cambios en ADR-003 ni en el stack.
- (+) El dominio se usa desde el primer día, y el nombre se conserva al pasar de un escalón a otro.
- (−) La URL solo responde mientras el equipo esté encendido.
- (−) Desde Argentina, la nube en EE. UU. (escalón C) suma latencia; no se midió.
- (−) Access exige un método de pago aunque el plan sea gratuito (según foros de la comunidad; no se pudo confirmar en documentación oficial).
- (−) Cada persona sigue siendo un posible punto de falla: el equipo guarda el `.env` y la base, que hay que cifrar y respaldar.

## Verificaciones pendientes

Se resuelven con una prueba de concepto sin costo, que es la primera historia propuesta:

- Que Cloudflare Tunnel sea gratuito sin límites ocultos y los límites reales de Access.
- Consumo real de RAM, CPU y latencia desde Argentina con el gateway y `pr-reviewer` reales.
- Compatibilidad del MCP remoto con Access en Claude Code.
- Para el escalón C: RAM de la e2-micro (1 GB, 25% de CPU sostenida), si el tráfico por Tunnel cuenta contra el 1 GB de salida gratuita, y si hace falta cuenta de facturación y cómo cuenta la IP externa.
- Para la fase multiusuario: límites de la API de GitHub con tokens de usuario de GitHub App, y que Litestream funcione con `better-sqlite3`.
