import type { FastifyInstance } from 'fastify';
import { createServiceApp, settingsValidator, type CreateServiceAppOptions } from '@atalaya/core';
import { defaultSettings, settingsSchema } from './settings.js';

/** Arma el servicio del revisor. El `id` es el del registro del gateway. */
export function buildApp(
  options: Pick<CreateServiceAppOptions, 'internalToken' | 'logger'>,
): FastifyInstance {
  return createServiceApp({
    id: 'pr_reviewer',
    name: 'Revisor de pull requests',
    description: 'Lee pull requests de GitHub y ayuda a revisarlos con Claude.',
    version: '0.0.0',
    defaultSettings,
    validateSettings: settingsValidator(settingsSchema),
    ...options,
  });
}
