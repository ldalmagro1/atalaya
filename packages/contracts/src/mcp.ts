import { z } from 'zod';

/**
 * Niveles de acceso de una herramienta MCP (ADR-002). No existe `write`: ninguna herramienta
 * MCP puede publicar ni escribir fuera del borrador local.
 */
export const MCP_ACCESS_VALUES = ['read', 'draft'] as const;
export const mcpAccessSchema = z.enum(MCP_ACCESS_VALUES);
export type McpAccess = z.infer<typeof mcpAccessSchema>;

/** Nombres de herramienta y de prompt: minúsculas, números y guion bajo. */
export const MCP_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const nameSchema = z.string().min(1).max(64).regex(MCP_NAME_PATTERN, 'nombre inválido');

/** JSON Schema de la entrada de una herramienta (se genera desde zod con `z.toJSONSchema`). */
export const mcpInputSchemaSchema = z.record(z.string(), z.unknown());

export const mcpToolDefSchema = z.object({
  name: nameSchema,
  description: z.string().min(1),
  inputSchema: mcpInputSchemaSchema,
  access: mcpAccessSchema,
});
export type McpToolDef = z.infer<typeof mcpToolDefSchema>;

export const mcpPromptArgumentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
});
export type McpPromptArgument = z.infer<typeof mcpPromptArgumentSchema>;

export const mcpPromptDefSchema = z.object({
  name: nameSchema,
  description: z.string().min(1),
  arguments: z.array(mcpPromptArgumentSchema),
  /** Texto del prompt; `{{argumento}}` se reemplaza por el valor que pasa el usuario. */
  text: z.string().optional(),
});
export type McpPromptDef = z.infer<typeof mcpPromptDefSchema>;

/** Respuesta de `GET /internal/mcp` de cada servicio. */
export const serviceMcpSchema = z.object({
  tools: z.array(mcpToolDefSchema),
  prompts: z.array(mcpPromptDefSchema),
});
export type ServiceMcp = z.infer<typeof serviceMcpSchema>;

/** Respuesta de `GET /api/mcp/manifest` del gateway: nombres prefijados con el id de la herramienta. */
export const mcpManifestSchema = z.object({
  tools: z.array(mcpToolDefSchema),
  prompts: z.array(mcpPromptDefSchema),
});
export type McpManifest = z.infer<typeof mcpManifestSchema>;

/** Cuerpo de `POST /api/mcp/tools/:name`: los argumentos de la herramienta. */
export const mcpCallBodySchema = z.object({
  arguments: z.record(z.string(), z.unknown()).default({}),
});
export type McpCallBody = z.infer<typeof mcpCallBodySchema>;

/** Encabezado que exigen las rutas `/api/mcp/*` (fuerza el preflight de CORS). */
export const MCP_CLIENT_HEADER = 'x-atalaya-client';
export const MCP_CLIENT_VALUE = 'mcp';
