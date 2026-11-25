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
});
