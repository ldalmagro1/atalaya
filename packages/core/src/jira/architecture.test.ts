import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.claude']);
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
/** Ruta de la API REST de Jira: solo `packages/core/src/jira/` puede construir esas URLs. */
const JIRA_API = /\/rest\/api\/\d/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (SOURCE_FILE.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

/** Archivos fuera de `packages/core/src/jira/` que nombran la API REST de Jira. */
export function findJiraApiViolations(root: string): string[] {
  const allowedDir = join(root, 'packages', 'core', 'src', 'jira') + sep;
  const violations: string[] = [];
  for (const file of walk(root)) {
    if (file.startsWith(allowedDir)) continue;
    if (JIRA_API.test(readFileSync(file, 'utf8'))) violations.push(relative(root, file));
  }
  return violations;
}

describe('aislamiento de la API de Jira', () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('nadie fuera de packages/core/src/jira/ llama a la API de Jira', () => {
    expect(findJiraApiViolations(REPO_ROOT)).toEqual([]);
  });

  it('detecta una llamada prohibida y permite la de core/src/jira', () => {
    const root = mkdtempSync(join(tmpdir(), 'atalaya-arch-jira-'));
    temps.push(root);
    mkdirSync(join(root, 'packages', 'core', 'src', 'jira'), { recursive: true });
    mkdirSync(join(root, 'gateway', 'src'), { recursive: true });
    const call = "fetch('https://ejemplo.atlassian.net/rest/api/3/project/DEMO');\n";
    writeFileSync(join(root, 'packages', 'core', 'src', 'jira', 'client.ts'), call);
    expect(findJiraApiViolations(root)).toEqual([]);

    writeFileSync(join(root, 'gateway', 'src', 'malo.ts'), call);
    expect(findJiraApiViolations(root)).toEqual([join('gateway', 'src', 'malo.ts')]);
  });
});
