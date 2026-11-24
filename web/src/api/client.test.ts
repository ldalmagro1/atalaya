import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiRequestError } from './client';

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('pide solo rutas relativas /api (nunca otro puerto)', async () => {
    const fetchMock = mockFetch(() => json({ ok: true, tools: [] }));
    await api.health();
    const url = String((fetchMock.mock.calls as unknown[][])[0]?.[0]);
    expect(url).toBe('/api/health');
  });

  it('devuelve la salud validada', async () => {
    mockFetch(() => json({ ok: false, tools: [{ id: 'pr_reviewer', ok: false, version: null }] }));
    await expect(api.health()).resolves.toEqual({
      ok: false,
      tools: [{ id: 'pr_reviewer', ok: false, version: null }],
    });
  });

  it('traduce un error { code, message } del gateway', async () => {
    mockFetch(() => json({ code: 'TOOL_NOT_FOUND', message: 'No existe' }, 404));
    const error = await api.tools().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: 'TOOL_NOT_FOUND', message: 'No existe', status: 404 });
  });

  it('usa HTTP_ERROR si el error no tiene la forma esperada', async () => {
    mockFetch(() => Promise.resolve(new Response('boom', { status: 502 })));
    await expect(api.health()).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 502 });
  });

  it('rechaza una respuesta con forma inválida', async () => {
    mockFetch(() => json({ nada: true }));
    await expect(api.health()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('informa NETWORK_ERROR si el gateway está apagado', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(api.health()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
