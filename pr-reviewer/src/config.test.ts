import { isAbsolute } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const TOKEN = 'a'.repeat(32);

describe('loadConfig', () => {
  it('valida y devuelve la configuración con la ruta de la base absoluta', () => {
    const config = loadConfig({
      PR_REVIEWER_PORT: '3101',
      INTERNAL_TOKEN: TOKEN,
      DB_PATH: './data/atalaya.db',
    });
    expect(config.port).toBe(3101);
    expect(config.internalToken).toBe(TOKEN);
    expect(isAbsolute(config.dbPath)).toBe(true);
  });

  it('usa ./data/atalaya.db si falta DB_PATH', () => {
    const config = loadConfig({ PR_REVIEWER_PORT: '3101', INTERNAL_TOKEN: TOKEN });
    expect(config.dbPath.replace(/\\/g, '/')).toMatch(/\/data\/atalaya\.db$/);
  });

  it('falla si faltan variables o son inválidas, sin mostrar sus valores', () => {
    expect(() => loadConfig({})).toThrow(/PR_REVIEWER_PORT/);
    expect(() => loadConfig({ PR_REVIEWER_PORT: '3101', INTERNAL_TOKEN: 'corto-secreto' })).toThrow(
      /INTERNAL_TOKEN/,
    );
    try {
      loadConfig({ PR_REVIEWER_PORT: '3101', INTERNAL_TOKEN: 'corto-secreto' });
    } catch (error) {
      expect(String(error)).not.toContain('corto-secreto');
    }
    expect(() => loadConfig({ PR_REVIEWER_PORT: '99999', INTERNAL_TOKEN: TOKEN })).toThrow(
      /PR_REVIEWER_PORT/,
    );
  });
});
