import { describe, expect, it } from 'vitest';
import { PROJECT_NAME, serviceBanner } from './index';

describe('@atalaya/contracts', () => {
  it('arma el banner de un servicio', () => {
    expect(serviceBanner('gateway')).toBe(`[${PROJECT_NAME}] gateway (placeholder)`);
  });
});
