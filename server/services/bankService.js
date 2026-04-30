const axios = require('axios');
const xml2js = require('xml2js');
const db = require('../database');

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

/**
 * Bank-API Service
 *
 * Unterstützte Anbindungen:
 * 1. Generic REST API (z.B. bankeigene API mit Bearer-Token)
 * 2. camt.054 XML-Datei-Upload (ISO 20022 – alle CH-Banken, inkl. SHKB)
 * 3. Webhook-Empfang (Bank sendet Zahlungen aktiv)
 *
 * Für SHKB (Schaffhauser Kantonalbank):
 * - EBICS-Zugang beantragen (E002/A005/X002-Schlüssel)
 * - camt.054 per EBICS-FetchFile abrufen
 * - Oder: Zahlungsbenachrichtigungen per E-Mail → camt.054 als Anhang → hier verarbeiten
 */

/**
 * Verarbeitet eine camt.054 XML-Struktur und extrahiert Zahlungen.
 * Gibt Array von { referenceNumber, amount, currency, date, creditorRef } zurück.
 */
async function parseCamt054(xmlString) {
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
  const result = await parser.parseStringPromise(xmlString);

  const payments = [];
  try {
    const document = result.Document || result['Document'];
    const BkToCstmrDbtCdtNtfctn = document.BkToCstmrDbtCdtNtfctn;
    const ntfctn = BkToCstmrDbtCdtNtfctn.Ntfctn;
    const entries = Array.isArray(ntfctn.Ntry) ? ntfctn.Ntry : [ntfctn.Ntry];

    for (const entry of entries) {
      if (!entry) continue;
      const cdtDbtInd = entry.CdtDbtInd;
      if (cdtDbtInd !== 'CRDT') continue; // Nur Gutschriften (Eingänge)

      const txDetails = entry.NtryDtls?.TxDtls;
      const txList = Array.isArray(txDetails) ? txDetails : [txDetails];

      for (const tx of txList) {
        if (!tx) continue;
        const ref =
          tx.RmtInf?.Strd?.CdtrRefInf?.Ref ||
          tx.RmtInf?.Ustrd ||
          tx.Refs?.EndToEndId ||
          entry.AcctSvcrRef ||
          null;

        const amount = parseFloat(entry.Amt?._ || entry.Amt || 0);
        const currency = entry.Amt?.$?.Ccy || 'CHF';
        const bookingDate = entry.BookgDt?.Dt || entry.ValDt?.Dt || new Date().toISOString().split('T')[0];

        if (ref && amount > 0) {
          payments.push({ referenceNumber: ref.trim(), amount, currency, date: bookingDate });
        }
      }
    }
  } catch (err) {
    console.error('[BankService] Fehler beim Parsen von camt.054:', err.message);
  }
  return payments;
}

/**
 * Ruft Zahlungen über eine REST-Bank-API ab.
 * Konfiguration über app_settings:
 *   bank_api_url      - Basis-URL der Bank-API
 *   bank_api_key      - Bearer-Token / API-Key
 *   bank_api_account  - Kontonummer / IBAN
 */
async function fetchPaymentsFromBankAPI() {
  const s = getSettings();
  if (!s.bank_api_url || !s.bank_api_key) return [];

  try {
    const headers = { Authorization: `Bearer ${s.bank_api_key}` };
    const params = {};
    if (s.bank_api_account) params.account = s.bank_api_account;

    // Letzten 30 Tage abrufen
    const since = new Date();
    since.setDate(since.getDate() - 30);
    params.from = since.toISOString().split('T')[0];

    const res = await axios.get(`${s.bank_api_url}/transactions`, { headers, params, timeout: 10000 });
    const transactions = res.data?.transactions || res.data?.data || res.data || [];

    return transactions.map(tx => ({
      referenceNumber: tx.reference || tx.remittanceInfo || tx.ref,
      amount: parseFloat(tx.amount || tx.creditAmount || 0),
      currency: tx.currency || 'CHF',
      date: tx.bookingDate || tx.valueDate || tx.date,
    })).filter(tx => tx.referenceNumber && tx.amount > 0);
  } catch (err) {
    console.error('[BankService] Fehler beim API-Abruf:', err.message);
    return [];
  }
}

/**
 * Verarbeitet erkannte Zahlungen:
 * Sucht für jede Referenznummer das passende Projekt und bucht die Zahlung.
 * Gibt Anzahl der verarbeiteten Zahlungen zurück.
 */
const { v4: uuidv4 } = require('uuid');

function processPayments(payments) {
  let processed = 0;
  for (const pay of payments) {
    const settings = db.prepare(
      'SELECT * FROM payment_settings WHERE reference_number = ?'
    ).get(pay.referenceNumber);
    if (!settings) continue;

    const now = new Date();
    const pDate = pay.date ? new Date(pay.date) : now;
    let periodMonth = pDate.getMonth() + 1;
    let periodYear = pDate.getFullYear();

    const monthsCovered = settings.billing_cycle === 'yearly'
      ? (Math.round(pay.amount / settings.monthly_amount) || 12)
      : (Math.round(pay.amount / settings.monthly_amount) || 1);

    for (let i = 0; i < monthsCovered; i++) {
      let m = periodMonth + i;
      let y = periodYear;
      while (m > 12) { m -= 12; y++; }

      const existing = db.prepare(
        "SELECT id FROM payments WHERE project_id = ? AND period_month = ? AND period_year = ? AND status = 'confirmed'"
      ).get(settings.project_id, m, y);

      if (!existing) {
        db.prepare(`
          INSERT INTO payments (id, project_id, amount, reference_number, payment_date, period_month, period_year, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')
        `).run(uuidv4(), settings.project_id, settings.monthly_amount, pay.referenceNumber, pay.date, m, y);

        db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
          uuidv4(), settings.project_id, 'bank_payment_imported',
          `Bank-Zahlung ${pay.amount} ${pay.currency} empfangen (Ref: ${pay.referenceNumber}, ${m}/${y})`,
          'System (Bank-Sync)'
        );
        processed++;
      }
    }
  }
  return processed;
}

/**
 * Hauptfunktion: Bank-Sync ausführen (API-Abruf + Verarbeitung)
 */
async function syncBankPayments() {
  const payments = await fetchPaymentsFromBankAPI();
  if (payments.length === 0) return { fetched: 0, processed: 0 };
  const processed = processPayments(payments);
  return { fetched: payments.length, processed };
}

module.exports = { syncBankPayments, parseCamt054, processPayments };
