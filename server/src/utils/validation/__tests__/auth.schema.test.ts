import { registerSchema, passwordSchema, loginSchema } from '../auth.schema';

describe('passwordSchema', () => {
  it('accepts a password meeting all complexity rules', () => {
    expect(passwordSchema.safeParse('GoodPassword123!').success).toBe(true);
  });

  it.each([
    ['too short', 'Sh0rt!'],
    ['no uppercase', 'lowercase123!'],
    ['no lowercase', 'UPPERCASE123!'],
    ['no number', 'NoNumbersHere!'],
    ['no special character', 'NoSpecialChar123'],
  ])('rejects a password that is %s', (_label, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });
});

describe('registerSchema - mass assignment protection', () => {
  it('accepts a valid email + password payload', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'GoodPassword123!',
    });
    expect(result.success).toBe(true);
  });

  it('strips any extra fields not declared in the schema (e.g. an injected role)', () => {
    // This is the actual test of the mass-assignment defense: a client attempting
    // to register as an admin by adding a "role" field to the request body must
    // have that field silently dropped, not accepted or rejected with an error
    // that would reveal the field exists.
    const result = registerSchema.safeParse({
      email: 'attacker@example.com',
      password: 'GoodPassword123!',
      role: 'system-admin',
      failedLoginAttempts: -999,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('role');
      expect(result.data).not.toHaveProperty('failedLoginAttempts');
      expect(Object.keys(result.data)).toEqual(['email', 'password']);
    }
  });

  it('rejects an invalid email format', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'GoodPassword123!',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts login without an MFA token (not all accounts have MFA enabled)', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'anything' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed MFA token length', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'anything',
      mfaToken: '12', // TOTP codes are always 6 digits
    });
    expect(result.success).toBe(false);
  });
});
