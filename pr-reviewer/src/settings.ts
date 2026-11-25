import { z } from 'zod';

const MAX_CONTEXT_CHARS = 50_000;

/** Configuración por repositorio del revisor. No hay proveedor ni modelo de IA (ADR-002). */
export const settingsSchema = z.object({
  contextMd: z
    .string({ error: 'Debe ser un texto.' })
    .max(MAX_CONTEXT_CHARS, `No puede superar los ${MAX_CONTEXT_CHARS} caracteres.`),
});
export type PrReviewerSettings = z.infer<typeof settingsSchema>;

const CONTEXT_TEMPLATE = `# Contexto del repositorio

## Arquitectura
(Describe capas, módulos principales y cómo se relacionan.)

## Convenciones
(Nombres, estructura de carpetas, manejo de errores, estilo de tests, lo que el equipo exige.)

## Decisiones de diseño
(Decisiones tomadas y su motivo. Qué NO hay que cambiar sin discutirlo.)

## Reglas de dominio
(Invariantes del negocio que el código debe respetar siempre.)

## Zonas frágiles
(Partes del código que se rompen fácil, tienen deuda técnica o requieren cuidado extra.)
`;

export const defaultSettings: PrReviewerSettings = { contextMd: CONTEXT_TEMPLATE };
