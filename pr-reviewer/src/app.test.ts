import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToolManifest } from '@atalaya/contracts';
import { buildApp } from './app.js';
import { defaultSettings } from './settings.js';

const TOKEN = 'token-de-prueba-super-secreto-1234567890';
const HEADER = { 'x-atalaya-internal-token': TOKEN };

describe('servicio pr_reviewer', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp({ internalToken: TOKEN, logger: { level: 'silent' } });
  });
  afterEach(async () => {
    await app.close();
  });

  const validate = async (settings: object) =>
    (
      await app.inject({
        method: 'POST',
        url: '/internal/settings/validate',
        headers: HEADER,
        payload: { settings },
      })
    ).json<unknown>();

  it('publica un manifiesto válido con la plantilla por defecto', async () => {
    const res = await app.inject({ method: 'GET', url: '/internal/manifest', headers: HEADER });
    const manifest = ToolManifest.parse(res.json());
    expect(manifest.id).toBe('pr_reviewer');
    expect(manifest.defaultSettings).toEqual(defaultSettings);
    for (const title of [
      '# Contexto del repositorio',
      '## Arquitectura',
      '## Convenciones',
      '## Decisiones de diseño',
      '## Reglas de dominio',
      '## Zonas frágiles',
    ]) {
      expect(defaultSettings.contextMd).toContain(title);
    }
  });

  it('acepta sus valores por defecto y el máximo de 50000 caracteres', async () => {
    expect(await validate(defaultSettings)).toEqual({ ok: true, settings: defaultSettings });
    expect(await validate({ contextMd: 'a'.repeat(50_000) })).toMatchObject({ ok: true });
  });

  it('descarta las claves que no conoce', async () => {
    expect(await validate({ contextMd: 'x', model: 'otro' })).toEqual({
      ok: true,
      settings: { contextMd: 'x' },
    });
  });

  it.each([
    ['falta contextMd', {}],
    ['contextMd no es texto', { contextMd: 3 }],
    ['contextMd supera el máximo', { contextMd: 'a'.repeat(50_001) }],
  ])('rechaza settings si %s', async (_caso, settings) => {
    expect(await validate(settings)).toEqual({
      ok: false,
      errors: [{ path: 'contextMd', message: expect.any(String) }],
    });
  });
});
