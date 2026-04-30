/**
 * Schweizer QR-Referenz Generator (Mod-10 rekursiv)
 * Standard für QR-IBAN (Format: CH..30000..)
 *
 * Liefert 27-stellige Referenz: 26 Ziffern + 1 Prüfziffer
 */
const MOD10_TABLE = [
  [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
  [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
  [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
  [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
  [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
  [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
  [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
  [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
  [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
  [5, 0, 9, 4, 6, 8, 2, 7, 1, 3],
];

function mod10CheckDigit(digits) {
  let report = 0;
  for (const d of digits) {
    const n = parseInt(d, 10);
    if (isNaN(n)) continue;
    report = MOD10_TABLE[report][n];
  }
  return ((10 - report) % 10).toString();
}

/**
 * Erzeugt eine QR-Referenz aus einer Rechnungsnummer (z.B. "RE-2026-0001").
 * Es werden nur Ziffern verwendet, links mit 0 auf 26 Stellen aufgefüllt,
 * dann wird die Prüfziffer angehängt → 27 Stellen.
 */
function generateQRReference(invoiceNumber) {
  const digits = String(invoiceNumber).replace(/\D/g, '');
  const padded = digits.padStart(26, '0').slice(-26);
  return padded + mod10CheckDigit(padded);
}

/**
 * Erkennt ob es sich um eine QR-IBAN handelt (CH..3xxxx..).
 * QR-IBAN-Institutionen haben Stellen 5-9 = 30000-31999.
 */
function isQRIban(iban) {
  if (!iban) return false;
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!clean.startsWith('CH') && !clean.startsWith('LI')) return false;
  if (clean.length < 9) return false;
  const inst = parseInt(clean.substring(4, 9), 10);
  return inst >= 30000 && inst <= 31999;
}

/**
 * SCOR-Referenz (ISO 11649 Creditor Reference) für normale IBANs.
 * Format: RF + 2 Prüfziffern + max. 21 alphanumerische Zeichen.
 */
function generateSCORReference(invoiceNumber) {
  const ref = String(invoiceNumber).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 21);
  // Mod-97-10 Prüfziffer: ref + "RF00", Buchstaben als Zahlen (A=10, B=11, ...)
  const numeric = (ref + 'RF00').split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 48 && code <= 57) return c;
    return (code - 55).toString();
  }).join('');
  let mod = 0;
  for (const d of numeric) {
    mod = (mod * 10 + parseInt(d, 10)) % 97;
  }
  const check = (98 - mod).toString().padStart(2, '0');
  return `RF${check}${ref}`;
}

module.exports = { generateQRReference, generateSCORReference, isQRIban, mod10CheckDigit };
