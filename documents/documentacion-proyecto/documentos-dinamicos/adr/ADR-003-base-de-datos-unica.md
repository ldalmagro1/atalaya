# ADR-003 · Una sola base SQLite compartida, con tablas separadas por servicio

Nov 21, 2026 · @Lucas · v0.1

*Estado:* Aceptada. *Depende de:* ADR-001.

## Contexto

Con un servicio por herramienta (ADR-001), lo habitual sería una base por servicio. Se prefiere un único archivo para tener un solo lugar donde respaldar, inspeccionar y migrar los datos de una plataforma de uso local.

## Alternativas

| Alternativa | Aislamiento lógico | Respaldo e inspección | Despliegue |
|---|---|---|---|
| **A. Un archivo `atalaya.db` (WAL), tablas con prefijo por servicio, sin acceso cruzado** | **Por convención y por test** | **Un archivo** | **Todos los servicios en la misma máquina o volumen** |
| B. Un archivo, con todo el acceso a datos centralizado en el gateway | Alto | Un archivo | Igual que A; todos dependen del gateway para datos |
| C. Un archivo SQLite por servicio | Alto | Varios archivos | Cada servicio con su volumen |

## Decisión

Se adopta la alternativa **A**.

1. Un único archivo (`DB_PATH`, por defecto `./data/atalaya.db`), abierto por cada servicio con `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON` y `busy_timeout`. SQLite serializa las escrituras, lo cual es suficiente para un solo usuario.
2. **Cada servicio es dueño de sus tablas y las nombra con su prefijo**: `gateway_` (repositorios, configuración), `core_` (caché de GitHub, migraciones) y `prreviewer_` (revisiones, hallazgos).
3. **Las migraciones viven en la carpeta de cada servicio** (`<servicio>/db/migrations/NNN_nombre.sql`) y las aplica el ejecutor de `@atalaya/core`, que registra en `core_migrations (service, name)` cuáles corrieron.
4. **Ningún servicio lee ni escribe tablas de otro, ni declara claves foráneas hacia ellas.** Si necesita un dato ajeno, lo pide por la API a través del gateway. Un test recorre las consultas SQL de cada servicio y falla si usa un prefijo ajeno.
5. Las referencias entre servicios son valores simples (por ejemplo, `owner` y `name` del repositorio) sin restricción de clave foránea.

## Consecuencias

- (+) Un archivo para respaldar, inspeccionar y copiar.
- (+) Los prefijos permiten separar la base más adelante, tabla por tabla, sin reescribir las herramientas.
- (−) **Todos los servicios deben correr en la misma máquina o volumen.** Esto condiciona la decisión de hosting (ATAL-26): en una nube con varios hosts habría que migrar a una base gestionada.
- (−) Las escrituras concurrentes se serializan: aceptable para un usuario, un límite si algún día hay varios.
- (−) El aislamiento depende de una regla y de un test, no de la base.
- (−) Una migración defectuosa de un servicio puede dejar bloqueado el archivo para todos mientras corre.
