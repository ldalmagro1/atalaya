/** Proyecto de Jira tal como lo usa Atalaya. */
export interface JiraProject {
  key: string;
  name: string;
}

/**
 * Única forma de hablar con Jira: ningún archivo fuera de `packages/core/src/jira/` llama a su
 * API. Las implementaciones traducen los errores a `AppError`.
 */
export interface JiraProvider {
  getProject(key: string): Promise<JiraProject>;
}
