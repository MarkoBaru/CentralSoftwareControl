const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const KEY_FILE = path.join(__dirname, '..', '..', '.encryption-key');

function loadOrCreateKey() {
  if (process.env.CCD_ENCRYPTION_KEY) {
    const buf = Buffer.from(process.env.CCD_ENCRYPTION_KEY, 'hex');
    if (buf.length === 32) return buf;
    console.warn('[Crypto] CCD_ENCRYPTION_KEY hat falsche Laenge, generiere neue Datei-Key');
  }
  if (fs.existsSync(KEY_FILE)) {
    const buf = Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
    if (buf.length === 32) return buf;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  console.log('[Crypto] Neuer Schluessel erzeugt:', KEY_FILE);
  return key;
}

const KEY = loadOrCreateKey();

function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return '';
  if (typeof plaintext === 'string' && plaintext.startsWith(PREFIX)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(value) {
  if (!value) return '';
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  try {
    const data = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const enc = data.slice(28);
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('[Crypto] Entschluesselung fehlgeschlagen:', err.message);
    return '';
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

module.exports = { encrypt, decrypt, isEncrypted };
