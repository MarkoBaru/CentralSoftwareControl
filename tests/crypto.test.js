const { encrypt, decrypt, isEncrypted } = require('../server/services/crypto');

describe('crypto service', () => {
  test('encrypt/decrypt round-trip', () => {
    const plain = 'Geheimes Passwort 123!';
    const enc = encrypt(plain);
    expect(isEncrypted(enc)).toBe(true);
    expect(decrypt(enc)).toBe(plain);
  });

  test('encrypt liefert verschiedene Ciphertexte fuer denselben Input (IV-Randomness)', () => {
    const a = encrypt('hallo');
    const b = encrypt('hallo');
    expect(a).not.toBe(b);
  });

  test('encrypt verschluesselt nicht doppelt', () => {
    const enc = encrypt('test');
    expect(encrypt(enc)).toBe(enc);
  });

  test('decrypt liefert leeren String fuer leere Werte', () => {
    expect(decrypt('')).toBe('');
    expect(decrypt(null)).toBe('');
  });

  test('decrypt liefert Original fuer unverschluesselte Werte (Klartext-Migration)', () => {
    expect(decrypt('klartext')).toBe('klartext');
  });

  test('decrypt liefert leeren String bei beschaedigtem Ciphertext', () => {
    expect(decrypt('enc:v1:invalid-base64!')).toBe('');
  });
});
