import { z } from 'zod';
import { serviceMcpSchema, type ServiceMcp } from '@atalaya/contracts';

/**
 * Herramienta MCP tal como la registra un servicio: la declaración (`access` se valida en
 * `parseServiceMcp`) más el manejador que ejecuta la llamada. El manejador valida sus argumentos.
 */
export interface McpToolRegistration {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  access: string;
  handler?: (args: Record<string, unknown>) => unknown;
}

/** JSON Schema de entrada de una herramienta MCP, generado desde su schema de zod. */
export function toolInputSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  delete jsonSchema['$schema'];
  return jsonSchema;
}

/**
 * Valida lo que un servicio declara para MCP. Una herramienta con `access` fuera de
 * `read` y `draft` (p. ej. `write`) hace fallar el registro con un error claro.
 */
export function parseServiceMcp(input: unknown): ServiceMcp {
  const result = serviceMcpSchema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `Declaración MCP inválida (las herramientas solo pueden ser 'read' o 'draft'): ${detail}`,
    );
  }
  const names = [...result.data.tools, ...result.data.prompts].map((item) => item.name);
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated) throw new Error(`Declaración MCP inválida: nombre repetido «${repeated}».`);
  return result.data;
}
