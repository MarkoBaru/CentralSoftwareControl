const { schemas } = require('../server/services/validation');

describe('validation schemas', () => {
  test('login: valid input', () => {
    const r = schemas.login.safeParse({ email: 'A@b.co', password: 'secret' });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('a@b.co'); // lowercased
  });

  test('login: invalid email', () => {
    const r = schemas.login.safeParse({ email: 'no-at', password: 'x' });
    expect(r.success).toBe(false);
  });

  test('login: optional totp 6 digits', () => {
    expect(schemas.login.safeParse({ email: 'a@b.co', password: 'x', totp: '123456' }).success).toBe(true);
    expect(schemas.login.safeParse({ email: 'a@b.co', password: 'x', totp: '12' }).success).toBe(false);
    expect(schemas.login.safeParse({ email: 'a@b.co', password: 'x', totp: 'abcdef' }).success).toBe(false);
  });

  test('setup: requires strong-ish password >= 8', () => {
    expect(schemas.setup.safeParse({ email: 'a@b.co', password: '1234567', name: 'X' }).success).toBe(false);
    expect(schemas.setup.safeParse({ email: 'a@b.co', password: '12345678', name: 'X' }).success).toBe(true);
  });

  test('passwordResetConfirm: token + min 8 password', () => {
    const ok = schemas.passwordResetConfirm.safeParse({ token: 'a'.repeat(40), password: 'newSecret1' });
    expect(ok.success).toBe(true);
    const bad = schemas.passwordResetConfirm.safeParse({ token: 'short', password: 'newSecret1' });
    expect(bad.success).toBe(false);
  });
});
