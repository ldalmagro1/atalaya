import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.claude']);
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (SOURCE_FILE.test(entry.name) || entry.name === 'package.json') {
      yield join(dir, entry.name);
    }
  }
}

/**
 * Archivos que mencionan `@octokit/*` fuera de `packages/core/src/github/`. La excepción es
 * `packages/core/package.json`, que declara la dependencia. Ignora este mismo archivo.
 */
export function findOctokitViolations(root: string): string[] {
  const allowedDir = join(root, 'packages', 'core', 'src', 'github') + sep;
  const allowedFiles = new Set([join(root, 'packages', 'core', 'package.json')]);
  const violations: string[] = [];
  for (const file of walk(root)) {
    if (file.startsWith(allowedDir) || allowedFiles.has(file)) continue;
    if (/@octokit\//.test(readFileSync(file, 'utf8'))) violations.push(relative(root, file));
  }
  return violations;
}

describe('aislamiento de Octokit', () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('nadie fuera de packages/core/src/github/ importa @octokit/*', () => {
    expect(findOctokitViolations(REPO_ROOT)).toEqual([]);
  });

  it('detecta un import prohibido y permite el de core/src/github', () => {
    const root = mkdtempSync(join(tmpdir(), 'atalaya-arch-'));
    temps.push(root);
    mkdirSync(join(root, 'packages', 'core', 'src', 'github'), { recursive: true });
    mkdirSync(join(root, 'gateway', 'src'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'core', 'src', 'github', 'client.ts'),
      "import { Octokit } from '@octokit/rest';\n",
    );
    expect(findOctokitViolations(root)).toEqual([]);

    writeFileSync(
      join(root, 'gateway', 'src', 'malo.ts'),
      "import { Octokit } from '@octokit/rest';\n",
    );
    expect(findOctokitViolations(root)).toEqual([join('gateway', 'src', 'malo.ts')]);
  });
});
