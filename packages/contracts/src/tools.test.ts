import { describe, expect, it } from 'vitest';
import { SettingsValidationResult, ToolManifest } from './tools.js';

const manifest = {
  id: 'pr_reviewer',
  name: 'Revisor',
  description: 'Revisa pull requests.',
  version: '1.0.0',
  defaultSettings: { contextMd: '' },
};

describe('ToolManifest', () => {
  it('acepta un manifiesto completo', () => {
    expect(ToolManifest.parse(manifest)).toEqual(manifest);
  });

  it.each([
    ['un id con guion', { ...manifest, id: 'pr-reviewer' }],
    ['sin defaultSettings', { ...manifest, defaultSettings: undefined }],
    ['defaultSettings que no es un objeto', { ...manifest, defaultSettings: 'x' }],
  ])('rechaza %s', (_caso, value) => {
    expect(ToolManifest.safeParse(value).success).toBe(false);
  });
});

describe('SettingsValidationResult', () => {
  it('distingue el resultado válido del inválido', () => {
    expect(SettingsValidationResult.safeParse({ ok: true, settings: {} }).success).toBe(true);
    expect(
      SettingsValidationResult.safeParse({ ok: false, errors: [{ path: 'a', message: 'm' }] })
        .success,
    ).toBe(true);
    expect(SettingsValidationResult.safeParse({ ok: true }).success).toBe(false);
    expect(SettingsValidationResult.safeParse({ ok: false }).success).toBe(false);
  });
});
