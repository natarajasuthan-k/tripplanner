import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { RECOVER_MESSAGE, recoverRequestSchema, recoverResponseSchema } from '@tripplanner/shared';
import type { AppBindings } from '../env';
import type { SendEmail } from '../integrations/email';
import { runInBackground } from '../lib/background';
import { emailHash } from '../lib/hmac';
import { clientIp } from '../lib/http';
import { validationHook } from '../lib/validation';
import { checkRecoveryLimits, sendRecoveryEmail, tripsForEmail } from '../services/recoveryService';
import { errorResponse } from './common';

const recoverRoute = createRoute({
  method: 'post',
  path: '/recover',
  tags: ['Recovery'],
  summary: 'E17 — Email the organiser links for an address (same response either way)',
  request: {
    body: { required: true, content: { 'application/json': { schema: recoverRequestSchema } } },
  },
  responses: {
    202: {
      description: 'Accepted — identical whether or not trips match',
      content: { 'application/json': { schema: recoverResponseSchema } },
    },
    400: errorResponse('VALIDATION_ERROR'),
    429: errorResponse('RATE_LIMITED'),
  },
});

export function recoverRoutes(sendEmail: SendEmail) {
  return new OpenAPIHono<AppBindings>({ defaultHook: validationHook }).openapi(
    recoverRoute,
    async (c) => {
      const { email } = c.req.valid('json');
      const hash = await emailHash(c.env.EMAIL_HMAC_SECRET, email);
      await checkRecoveryLimits(c.var.db, hash, clientIp(c));
      const trips = await tripsForEmail(c.var.db, hash);
      await runInBackground(c, () => sendRecoveryEmail(c.env, sendEmail, email, trips));
      return c.json({ message: RECOVER_MESSAGE }, 202);
    },
  );
}
