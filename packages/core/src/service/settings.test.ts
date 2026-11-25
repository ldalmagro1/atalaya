import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createServiceApp, type CreateServiceAppOptions } from './create-service-app.js';
import { settingsValidator } from './settings.js';

const TOKEN = 'token-de-prueba-super-secreto-1234567890';
const HEADER = { 'x-atalaya-internal-token': TOKEN };
const URL = '/internal/settings/validate';

const apps: ReturnType<typeof createServiceApp>[] = [];
function build(options: Partial<CreateServiceAppOptions> = {}) {
  const app = createServiceApp({
    id: 'demo',
    name: 'Demo',
    description: 'Servicio de prueba',
    version: '1.0.0',
    internalToken: TOKEN,
    logger: { level: 'silent' },
    ...options,
  });
  apps.push(app);
  return app;
}
const validate = (app: ReturnType<typeof build>, payload: object) =>
  app.inject({ method: 'POST', url: URL, headers: HEADER, payload });

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('settings en createServiceApp', () => {
  const schema = z.object({ umbral: z.number().default(3), nombre: z.string() });
  const configured = () =>
    build({ defaultSettings: { umbral: 3 }, validateSettings: settingsValidator(schema) });

  it('publica defaultSettings en el manifiesto', async () => {
    const res = await configured().inject({
      method: 'GET',
      url: '/internal/manifest',
      headers: HEADER,
    });
    expect(res.json()).toMatchObject({ defaultSettings: { umbral: 3 } });
  });

  it('devuelve los valores normalizados', async () => {
    const res = await validate(configured(), { settings: { nombre: 'a', sobra: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, settings: { umbral: 3, nombre: 'a' } });
  });

  it('devuelve los errores con su path', async () => {
    const res = await validate(configured(), { settings: { umbral: 'x', nombre: 'a' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: false,
      errors: [{ path: 'umbral', message: expect.any(String) }],
    });
  });

  it('sin validateSettings solo admite el objeto vacío', async () => {
    const app = build();
    expect((await validate(app, { settings: {} })).json()).toEqual({ ok: true, settings: {} });
    expect((await validate(app, { settings: { x: 1 } })).json()).toMatchObject({
      ok: false,
      errors: [{ path: 'x' }],
    });
  });

  it.each([{}, { settings: 'no' }, { settings: [] }])(
    'rechaza el body %j con 400',
    async (payload) => {
      const res = await validate(configured(), payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    },
  );

  it('exige el token interno', async () => {
    const res = await configured().inject({ method: 'POST', url: URL, payload: { settings: {} } });
    expect(res.statusCode).toBe(401);
  });
});
