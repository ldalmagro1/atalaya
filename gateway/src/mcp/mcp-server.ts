import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
// Solo tipos de contracts: este proceso corre desde `dist/` con Node, que no carga los
// paquetes del workspace (son TypeScript). Lo que se importa en runtime es el SDK.
import type { McpManifest } from '@atalaya/contracts';

/** Mismos valores que `MCP_CLIENT_HEADER` y `MCP_CLIENT_VALUE` de contracts (hay un test que lo verifica). */
export const CLIENT_HEADER = 'X-Atalaya-Client';
export const CLIENT_VALUE = 'mcp';
export const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:3001';

export interface McpServerOptions {
  gatewayUrl?: string;
  /** Para inyectar un `fetch` falso en los tests. */
  fetchFn?: typeof fetch;
  /** Va a stderr: stdout es el protocolo MCP. Nunca recibe tokens ni cuerpos de respuesta. */
  log?: (message: string) => void;
  manifestTimeoutMs?: number;
  callTimeoutMs?: number;
}

const unreachable = (url: string) =>
  `No se pudo conectar con el gateway de Atalaya en ${url}. ¿Está corriendo? Iniciá la plataforma con «npm run dev» y volvé a intentar.`;

/** Arma el servidor MCP: un cliente liviano que lee el manifiesto del gateway y reenvía cada llamada. */
export function createMcpServer(options: McpServerOptions = {}): Server {
  const gatewayUrl = (options.gatewayUrl ?? DEFAULT_GATEWAY_URL).replace(/\/+$/, '');
  const fetchFn = options.fetchFn ?? fetch;
  const log = options.log ?? ((message: string) => console.error(`[atalaya-mcp] ${message}`));
  const manifestTimeoutMs = options.manifestTimeoutMs ?? 10_000;
  const callTimeoutMs = options.callTimeoutMs ?? 60_000;

  async function request(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    try {
      return await fetchFn(`${gatewayUrl}${path}`, {
        ...init,
        headers: { ...init.headers, [CLIENT_HEADER]: CLIENT_VALUE },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      log(`El gateway no responde (${error instanceof Error ? error.name : 'error'}).`);
      throw new McpError(ErrorCode.InternalError, unreachable(gatewayUrl));
    }
  }

  async function loadManifest(): Promise<McpManifest> {
    const response = await request('/api/mcp/manifest', {}, manifestTimeoutMs);
    if (!response.ok) {
      log(`El gateway respondió ${response.status} al pedir el manifiesto.`);
      throw new McpError(
        ErrorCode.InternalError,
        `El gateway de Atalaya respondió ${response.status} al pedir las herramientas.`,
      );
    }
    return (await response.json()) as McpManifest;
  }

  const server = new Server(
    { name: 'atalaya', version: '0.0.0' },
    { capabilities: { tools: {}, prompts: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const { tools } = await loadManifest();
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: { type: 'object' as const, ...tool.inputSchema },
        annotations: { readOnlyHint: tool.access === 'read' },
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (call) => {
    const { name, arguments: args } = call.params;
    let response: Response;
    try {
      response = await request(
        `/api/mcp/tools/${encodeURIComponent(name)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ arguments: args ?? {} }),
        },
        callTimeoutMs,
      );
    } catch (error) {
      // El gateway caído se informa como resultado de la herramienta, para que Claude lo lea.
      const message = error instanceof Error ? error.message : unreachable(gatewayUrl);
      return { isError: true, content: [{ type: 'text' as const, text: message }] };
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
          ? body.message
          : `El gateway respondió ${response.status}.`;
      log(`La herramienta ${name} falló con ${response.status}.`);
      return { isError: true, content: [{ type: 'text' as const, text: message }] };
    }
    const result =
      body && typeof body === 'object' && 'result' in body
        ? (body as { result: unknown }).result
        : body;
    const text = typeof result === 'string' ? result : JSON.stringify(result ?? null);
    return { content: [{ type: 'text' as const, text }] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const { prompts } = await loadManifest();
    return {
      prompts: prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      })),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (call) => {
    const { prompts } = await loadManifest();
    const prompt = prompts.find((candidate) => candidate.name === call.params.name);
    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, `El prompt «${call.params.name}» no existe.`);
    }
    const values = call.params.arguments ?? {};
    const text = (prompt.text ?? prompt.description).replace(
      /\{\{(\w+)\}\}/g,
      (_match, key: string) => values[key] ?? '',
    );
    return {
      description: prompt.description,
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
    };
  });

  return server;
}
