import { AppError } from '../lib/errors.js';

/**
 * Traduce un estado HTTP de Jira a `AppError`. Los mensajes son fijos: nunca se copia el cuerpo
 * ni las cabeceras de la respuesta, para que las credenciales no puedan filtrarse. Jira responde
 * 404 cuando la cuenta no tiene permiso sobre un proyecto, y 403 también puede significarlo.
 */
export function translateJiraStatus(status: number | null, projectKey: string): AppError {
  if (status === 401) {
    return new AppError(
      'JIRA_AUTH',
      'Jira rechazó las credenciales: son inválidas o el token venció. Revise JIRA_EMAIL y JIRA_API_TOKEN en .env.',
      502,
    );
  }
  if (status === 403 || status === 404) {
    return new AppError(
      'JIRA_PROJECT_NOT_FOUND',
      `El proyecto ${projectKey} no existe en Jira o la cuenta no tiene permiso para verlo.`,
      404,
    );
  }
  return new AppError(
    'JIRA_UNAVAILABLE',
    'No se pudo conectar con Jira o respondió con un error. Reintente más tarde.',
    502,
  );
}
