import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, loadConfig } from './config.js';

const TOKEN = 'a'.repeat(32);

describe('loadConfig', () => {
  it('aplica los valores por defecto y resuelve DB_PATH desde la raíz del repo', () => {
    const config = loadConfig({ INTERNAL_TOKEN: TOKEN });
    expect(config.port).toBe(3001);
    expect(config.toolPorts).toEqual({ pr_reviewer: 3101 });
    expect(config.dbPath).toBe(resolve(REPO_ROOT, './data/atalaya.db'));
  });

  it('lee los puertos y la base del entorno', () => {
    const config = loadConfig({
      INTERNAL_TOKEN: TOKEN,
      GATEWAY_PORT: '4000',
      PR_REVIEWER_PORT: '4100',
      DB_PATH: './otra/base.db',
    });
    expect(config.port).toBe(4000);
    expect(config.toolPorts.pr_reviewer).toBe(4100);
    expect(config.dbPath).toBe(resolve(REPO_ROOT, './otra/base.db'));
  });

  it('falla con un error claro sin INTERNAL_TOKEN', () => {
    expect(() => loadConfig({})).toThrow(/INTERNAL_TOKEN: es obligatorio/);
  });

  it('falla con un INTERNAL_TOKEN corto sin mostrar su valor', () => {
    const short = 'secreto-corto';
    let message = '';
    try {
      loadConfig({ INTERNAL_TOKEN: short });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toMatch(/INTERNAL_TOKEN: debe tener al menos 32 caracteres/);
    expect(message).not.toContain(short);
  });

  it('rechaza puertos inválidos', () => {
    expect(() => loadConfig({ INTERNAL_TOKEN: TOKEN, GATEWAY_PORT: '0' })).toThrow(/GATEWAY_PORT/);
    expect(() => loadConfig({ INTERNAL_TOKEN: TOKEN, PR_REVIEWER_PORT: 'abc' })).toThrow(
      /PR_REVIEWER_PORT/,
    );
  });

  it('devuelve un objeto inmutable', () => {
    const config = loadConfig({ INTERNAL_TOKEN: TOKEN });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.toolPorts)).toBe(true);
  });

  it('no lee variables de otras herramientas', () => {
    const config = loadConfig({ INTERNAL_TOKEN: TOKEN, OTRA_HERRAMIENTA_KEY: 'valor-ajeno' });
    expect(JSON.stringify(config)).not.toContain('valor-ajeno');
  });

  describe('Jira', () => {
    const jiraEnv = {
      INTERNAL_TOKEN: TOKEN,
      JIRA_BASE_URL: 'https://ejemplo.atlassian.net/',
      JIRA_EMAIL: 'persona@ejemplo.test',
      JIRA_API_TOKEN: 'jira-token-de-prueba',
    };

    it('sin variables de Jira, jira es null', () => {
      expect(loadConfig({ INTERNAL_TOKEN: TOKEN }).jira).toBeNull();
      expect(loadConfig({ ...jiraEnv, JIRA_BASE_URL: '', JIRA_EMAIL: ' ' }).jira).toBeNull();
    });

    it('con las tres variables, las lee y quita la barra final', () => {
      expect(loadConfig(jiraEnv).jira).toEqual({
        baseUrl: 'https://ejemplo.atlassian.net',
        email: 'persona@ejemplo.test',
        apiToken: 'jira-token-de-prueba',
      });
    });

    it('si falta alguna de las tres, jira es null', () => {
      expect(loadConfig({ ...jiraEnv, JIRA_API_TOKEN: undefined }).jira).toBeNull();
    });

    it('rechaza una JIRA_BASE_URL con otra forma sin mostrar su valor', () => {
      const bad = 'http://otro-sitio.test/secreto';
      let message = '';
      try {
        loadConfig({ ...jiraEnv, JIRA_BASE_URL: bad });
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }
      expect(message).toMatch(/JIRA_BASE_URL/);
      expect(message).not.toContain(bad);
    });
  });
});
