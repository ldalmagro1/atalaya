import { describe, expect, it } from 'vitest';
import {
  PROJECT_NAME,
  apiErrorSchema,
  healthResponseSchema,
  serviceBanner,
  toolsResponseSchema,
} from './index';

describe('@atalaya/contracts', () => {
  it('arma el banner de un servicio', () => {
    expect(serviceBanner('gateway')).toBe(`[${PROJECT_NAME}] gateway (placeholder)`);
  });
});

describe('schemas del gateway', () => {
  it('acepta una salud válida y rechaza una inválida', () => {
    const valida = {
      ok: false,
      tools: [{ id: 'pr_reviewer', ok: false, version: null }],
      githubConfigured: false,
      jiraConfigured: false,
    };
    expect(healthResponseSchema.safeParse(valida).success).toBe(true);
    expect(healthResponseSchema.safeParse({ ok: true }).success).toBe(false);
  });

  it('acepta el listado de herramientas', () => {
    const lista = {
      tools: [{ id: 'pr_reviewer', name: 'Revisor', description: 'd', version: '0.0.0' }],
    };
    expect(toolsResponseSchema.safeParse(lista).success).toBe(true);
    expect(toolsResponseSchema.safeParse({ tools: [{ id: 1 }] }).success).toBe(false);
  });

  it('valida la forma de los errores', () => {
    expect(apiErrorSchema.safeParse({ code: 'X', message: 'm' }).success).toBe(true);
    expect(apiErrorSchema.safeParse({ code: 'X' }).success).toBe(false);
  });
});
