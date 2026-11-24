import { describe, expect, it } from 'vitest';
import css from './main.css?raw';

const ON_PRIMARY = [12, 13, 13]; // texto fijo del botón primario: rgb(12,13,13)

function block(selector: ':root' | '.dark'): string {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('}', start));
}

function token(selector: ':root' | '.dark', name: string): number[] {
  const match = new RegExp(`--${name}: (\\d+) (\\d+) (\\d+)`).exec(block(selector));
  if (!match) throw new Error(`Falta --${name} en ${selector}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance(color: number[]): number {
  const [r = 0, g = 0, b = 0] = color.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number[], b: number[]): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('contraste del botón primario (texto fijo rgb(12,13,13))', () => {
  it.each([
    ['claro', ':root', 'primary-500'],
    ['oscuro', '.dark', 'primary-500'],
    // hover: primary-400 en claro y primary-600 en oscuro (ver Button.tsx)
    ['claro (hover)', ':root', 'primary-400'],
    ['oscuro (hover)', '.dark', 'primary-600'],
  ] as const)('tema %s cumple al menos 6:1', (_name, selector, tokenName) => {
    expect(contrast(token(selector, tokenName), ON_PRIMARY)).toBeGreaterThanOrEqual(6);
  });
});

describe('contraste del texto y los enlaces sobre las tarjetas (background-100)', () => {
  it.each([
    ['claro', ':root'],
    ['oscuro', '.dark'],
  ] as const)(
    'tema %s: texto, texto secundario y enlaces cumplen al menos 4,5:1',
    (_name, selector) => {
      const card = token(selector, 'background-100');
      for (const tokenName of ['text-900', 'text-600', 'accent-600', 'accent-700']) {
        expect(contrast(token(selector, tokenName), card), tokenName).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
