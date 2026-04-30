const { generateQRReference, generateSCORReference, isQRIban, mod10CheckDigit } = require('../server/services/qrReference');

describe('qrReference', () => {
  test('mod10CheckDigit ist deterministisch und im Bereich 0-9', () => {
    const d = mod10CheckDigit('210000000003139471430009017');
    const n = Number(d);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(9);
  });

  test('generateQRReference liefert 27 Ziffern', () => {
    const ref = generateQRReference('RE-2026-0001');
    expect(ref).toHaveLength(27);
    expect(/^\d{27}$/.test(ref)).toBe(true);
  });

  test('generateQRReference ist deterministisch', () => {
    expect(generateQRReference('RE-2026-0001')).toBe(generateQRReference('RE-2026-0001'));
  });

  test('generateSCORReference startet mit RF und enthaelt nur ASCII', () => {
    const scor = generateSCORReference('RE-2026-0001');
    expect(scor.startsWith('RF')).toBe(true);
    expect(/^RF\d{2}[A-Z0-9]+$/.test(scor)).toBe(true);
  });

  test('isQRIban erkennt IID 30000-31999 als QR-IBAN', () => {
    expect(isQRIban('CH4430000123456789012')).toBe(true);
    expect(isQRIban('CH4431999000000000000')).toBe(true);
    expect(isQRIban('CH9300762011623852957')).toBe(false); // normale IBAN
    expect(isQRIban(null)).toBe(false);
    expect(isQRIban('')).toBe(false);
  });
});
