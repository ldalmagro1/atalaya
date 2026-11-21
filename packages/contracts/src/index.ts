export const PROJECT_NAME = 'Atalaya';

/** Línea que imprime cada servicio placeholder al arrancar. */
export function serviceBanner(service: string): string {
  return `[${PROJECT_NAME}] ${service} (placeholder)`;
}
