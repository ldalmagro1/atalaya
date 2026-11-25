import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer, DEFAULT_GATEWAY_URL } from './mcp-server.js';

/** Proceso MCP (transporte stdio). Los logs van a stderr: stdout es el protocolo. */
const server = createMcpServer({
  gatewayUrl: process.env['ATALAYA_GATEWAY_URL'] || DEFAULT_GATEWAY_URL,
});
await server.connect(new StdioServerTransport());
console.error('[atalaya-mcp] Servidor MCP listo (stdio).');
