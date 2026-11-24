import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  it('pasa de cargando a datos', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve('listo')));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('listo');
    expect(result.current.error).toBeNull();
  });

  it('expone el error', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('falló'))));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('falló');
  });

  it('reload vuelve a ejecutar la función', async () => {
    const fn = vi.fn(() => Promise.resolve(1));
    const { result } = renderHook(() => useAsync(fn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.reload());
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });

  it('cancela la señal al desmontar', () => {
    let captured: AbortSignal | undefined;
    const { unmount } = renderHook(() =>
      useAsync((signal) => {
        captured = signal;
        return new Promise<never>(() => {});
      }),
    );
    unmount();
    expect(captured?.aborted).toBe(true);
  });
});
