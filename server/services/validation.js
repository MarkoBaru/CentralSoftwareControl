const { z } = require('zod');

/**
 * Express-Middleware-Factory: validiert req.body gegen ein zod-Schema.
 * Bei Erfolg wird req.body durch das geparste (typisierte) Objekt ersetzt.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validierung fehlgeschlagen', issues });
    }
    req.body = result.data;
    next();
  };
}

// --- Schemas ---

const emailSchema = z.string().trim().toLowerCase().email('Ungueltige E-Mail');
const passwordSchema = z.string()
  .min(8, 'Mindestens 8 Zeichen')
  .max(200, 'Maximal 200 Zeichen');

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Passwort erforderlich').max(200),
  totp: z.string().regex(/^\d{6}$/, '6-stelliger Code').optional(),
});

const setupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(120),
});

const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

const totpCodeSchema = z.object({
  token: z.string().regex(/^\d{6}$/, '6-stelliger Code'),
});

module.exports = {
  validateBody,
  schemas: {
    login: loginSchema,
    setup: setupSchema,
    passwordResetRequest: passwordResetRequestSchema,
    passwordResetConfirm: passwordResetConfirmSchema,
    totpCode: totpCodeSchema,
  },
};
