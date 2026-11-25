import type { JiraCheckResult } from '@atalaya/contracts';
import type { JiraProvider } from './types.js';

/** Verifica que el proyecto exista y sea accesible; si no, `getProject` lanza `AppError`. */
export async function checkJiraProject(
  jira: JiraProvider,
  projectKey: string,
): Promise<JiraCheckResult> {
  const project = await jira.getProject(projectKey);
  return {
    ok: true,
    projectKey: project.key,
    projectName: project.name,
    message: `La cuenta accede al proyecto ${project.key} (${project.name}).`,
  };
}
