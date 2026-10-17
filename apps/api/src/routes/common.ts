import { z } from '@hono/zod-openapi';

export const errorBodySchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().nullable(),
    }),
  })
  .openapi('Error');

export const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorBodySchema } },
});

export const tokenParam = z.object({
  token: z.string().openapi({ param: { name: 'token', in: 'path' }, example: 'A'.repeat(43) }),
});

export const tokenDayParams = tokenParam.extend({
  dayId: z.string().openapi({ param: { name: 'dayId', in: 'path' } }),
});
