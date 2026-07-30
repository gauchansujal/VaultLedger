// Dummy values only, sufficient to satisfy env.ts's fail-fast validation without ever
// touching real secrets. Tests that need actual crypto behaviour (e.g. encryption
// round-trips) still exercise the real code path, just with a test-only key - never the
// production FIELD_ENCRYPTION_KEY, which must never appear in source control or CI logs.
process.env.CLIENT_ORIGIN = 'http://localhost:3000';
process.env.MONGO_URI = 'mongodb://localhost:27017/vaultledger-test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-for-real-use-0000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-for-real-use-0000000000000000';
process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64); // valid 64-hex-char format, test-only
