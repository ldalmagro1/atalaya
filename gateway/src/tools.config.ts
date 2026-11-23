import type { GatewayConfig } from './config.js';

export interface ToolEntry {
  id: string;
  baseUrl: string;
}

/** Ids de herramienta válidos: minúsculas, números y guion bajo. */
export const TOOL_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Registro estático de herramientas (ADR-001). Sumar una herramienta es una línea acá
 * (y su puerto en `config.ts`) más su carpeta en la raíz.
 */
export function registeredTools(config: Pick<GatewayConfig, 'toolPorts'>): ToolEntry[] {
  return [{ id: 'pr_reviewer', baseUrl: `http://127.0.0.1:${config.toolPorts.pr_reviewer}` }];
}
