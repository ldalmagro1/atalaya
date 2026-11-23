import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors.js';
import { createServiceApp } from './create-service-app.js';
import { listenLocal } from './listen-local.js';

const TOKEN = 'token-de-prueba-super-secreto-1234567890';
const HEADER = { 'x-atalaya-internal-token': TOKEN };
const manifest = {
  id: 'demo',
  name: 'Demo',
  description: 'Servicio de prueba',
  version: '1.2.3',
};

const apps: ReturnType<typeof createServiceApp>[] = [];
function build(logger?: Parameters<typeof createServiceApp>[0]['logger']) {
  const app = createServiceApp({
    ...manifest,
    internalToken: TOKEN,
    logger: logger ?? { level: 'silent' },
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('createServiceApp', () => {
  it('rechaza sin token y con token incorrecto con 401', async () => {
    const app = build();
    const sinToken = await app.inject({ method: 'GET', url: '/internal/health' });
    const incorrecto = await app.inject({
      method: 'GET',
      url: '/internal/health',
      headers: { 'x-atalaya-internal-token': 'otro' },
    });
    for (const res of [sinToken, incorrecto]) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        code: 'INVALID_INTERNAL_TOKEN',
        message: expect.any(String),
      });
    }
  });

  it('también protege rutas inexistentes', async () => {
    const res = await build().inject({ method: 'GET', url: '/no-existe' });
    expect(res.statusCode).toBe(401);
  });

  it('con token correcto responde health y manifest', async () => {
    const app = build();
    const health = await app.inject({ method: 'GET', url: '/internal/health', headers: HEADER });
    const man = await app.inject({ method: 'GET', url: '/internal/manifest', headers: HEADER });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true });
    expect(man.json()).toEqual(manifest);
  });

  it('ruta inexistente con token → 404 { code, message }', async () => {
    const res = await build().inject({ method: 'GET', url: '/no-existe', headers: HEADER });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
  });

  it('no devuelve cabeceras CORS ni responde preflight', async () => {
    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/health',
      headers: { ...HEADER, origin: 'http://127.0.0.1:5173' },
    });
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/internal/health',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'GET',
      },
    });
    for (const r of [res, preflight]) {
      expect(Object.keys(r.headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
    }
  });

  it('no escribe el token en respuestas ni en logs', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const app = build({ level: 'trace', stream });
    app.get('/falla', async () => {
      throw new Error('boom');
    });

    const responses = [
      await app.inject({ method: 'GET', url: '/internal/health', headers: HEADER }),
      await app.inject({ method: 'GET', url: '/internal/manifest', headers: HEADER }),
      await app.inject({ method: 'GET', url: '/falla', headers: HEADER }),
      await app.inject({
        method: 'GET',
        url: '/internal/health',
        headers: {
          'x-atalaya-internal-token': 'incorrecto-123',
          authorization: 'Bearer secreto-abc',
        },
      }),
    ];

    for (const res of responses) {
      expect(res.body).not.toContain(TOKEN);
      expect(JSON.stringify(res.headers)).not.toContain(TOKEN);
    }
    const logs = lines.join('');
    expect(logs.length).toBeGreaterThan(0);
    for (const secret of [TOKEN, 'incorrecto-123', 'secreto-abc']) {
      expect(logs).not.toContain(secret);
    }
  });

  it('exige un token no vacío', () => {
    expect(() => createServiceApp({ ...manifest, internalToken: '' })).toThrow();
  });
});

describe('manejo de errores', () => {
  it('AppError, zod, JSON inválido y errores internos tienen forma { code, message }', async () => {
    const app = build();
    app.get('/app-error', async () => {
      throw new AppError('TEACUP', 'Soy una tetera', 418);
    });
    app.post('/zod', async (request) => z.object({ n: z.number() }).parse(request.body));
    app.get('/interno', async () => {
      throw new Error('detalle interno secreto');
    });
    const headers = { ...HEADER, 'content-type': 'application/json' };

    const appError = await app.inject({ method: 'GET', url: '/app-error', headers: HEADER });
    expect(appError.statusCode).toBe(418);
    expect(appError.json()).toEqual({ code: 'TEACUP', message: 'Soy una tetera' });

    const zod = await app.inject({ method: 'POST', url: '/zod', headers, payload: { n: 'x' } });
    expect(zod.statusCode).toBe(400);
    expect(zod.json()).toEqual({ code: 'VALIDATION_ERROR', message: expect.stringContaining('n') });

    const malformado = await app.inject({ method: 'POST', url: '/zod', headers, payload: '{' });
    expect(malformado.statusCode).toBe(400);
    expect(malformado.json()).toEqual({ code: 'BAD_REQUEST', message: expect.any(String) });

    const interno = await app.inject({ method: 'GET', url: '/interno', headers: HEADER });
    expect(interno.statusCode).toBe(500);
    expect(interno.json()).toEqual({ code: 'INTERNAL_ERROR', message: 'Error interno.' });
  });
});

describe('listenLocal', () => {
  it('escucha solo en 127.0.0.1', async () => {
    const app = build({ level: 'silent' });
    await listenLocal(app, 0);
    const address = app.server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');

    const res = await fetch(`http://127.0.0.1:${address.port}/internal/health`, {
      headers: HEADER,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
