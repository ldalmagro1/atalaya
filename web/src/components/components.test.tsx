import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../theme/ThemeProvider';
import { HealthBanner } from './HealthBanner';
import { Layout } from './Layout';
import { MarkdownView } from './MarkdownView';
import { Modal } from './Modal';
import { Tabs } from './Tabs';

afterEach(() => vi.unstubAllGlobals());

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('MarkdownView', () => {
  it('muestra el HTML crudo como texto y no lo interpreta', () => {
    const { container } = render(
      <MarkdownView>{'hola <script>alert(1)</script> <img src=x onerror=alert(1)>'}</MarkdownView>,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });

  it('renderiza GFM y abre los enlaces de forma segura', () => {
    render(<MarkdownView>{'~~tachado~~ y [sitio](https://example.com)'}</MarkdownView>);
    expect(document.querySelector('del')?.textContent).toBe('tachado');
    const link = screen.getByRole('link', { name: 'sitio' });
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('no deja pasar enlaces javascript:', () => {
    render(<MarkdownView>{'[x](javascript:alert(1))'}</MarkdownView>);
    const link = document.querySelector('a');
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
  });
});

describe('Modal', () => {
  it('no renderiza nada cerrado y se cierra con Escape', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={false} title="T" onClose={onClose}>
        cuerpo
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <Modal open title="T" onClose={onClose}>
        cuerpo
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'T' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('enfoca el botón de cierre y lo cierra con click', async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="T" onClose={onClose}>
        cuerpo
      </Modal>,
    );
    const close = screen.getByRole('button', { name: 'Cerrar' });
    expect(document.activeElement).toBe(close);
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Tabs', () => {
  it('cambia de pestaña con click y con flechas', async () => {
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'A', content: <p>contenido A</p> },
          { id: 'b', label: 'B', content: <p>contenido B</p> },
        ]}
      />,
    );
    expect(screen.getByText('contenido A')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('contenido B')).toBeTruthy();
    expect(screen.queryByText('contenido A')).toBeNull();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('HealthBanner', () => {
  it('informa que el gateway no responde en lugar de romperse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    render(<HealthBanner />);
    expect((await screen.findByRole('alert')).textContent).toContain('El gateway no responde');
  });

  it('lista las herramientas que no responden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            ok: false,
            tools: [
              { id: 'pr_reviewer', ok: false, version: null },
              { id: 'otra', ok: true, version: '1.0.0' },
            ],
          }),
        ),
      ),
    );
    render(<HealthBanner />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('pr_reviewer');
    expect(alert.textContent).not.toContain('otra');
  });

  it('confirma cuando todo responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ ok: true, tools: [{ id: 'pr_reviewer', ok: true, version: '0.0.0' }] }),
        ),
      ),
    );
    render(<HealthBanner />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('responden'));
  });
});

describe('Layout', () => {
  it('muestra el nombre y un toggle de tema accesible', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<p>página</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText('Atalaya')).toBeTruthy();
    expect(screen.getByText('página')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Cambiar a tema oscuro' });
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeTruthy();
  });
});
